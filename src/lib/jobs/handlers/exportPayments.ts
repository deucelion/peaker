/**
 * Faz 12.1 — `export.payments` worker handler.
 *
 * Async export akışı (sync `exportAccountingFinancePaymentsCSV` ile parity):
 *   1. Payload: organizationId, dateFrom/dateTo (YYYY-MM-DD), paymentStatus,
 *      paymentKind, initiatorUserId.
 *   2. Modern `payments` schema'sını query'ler (deleted_at is null,
 *      organization scope + date range).
 *   3. Sync action ile aynı CSV header sırası ve label fonksiyonları kullanır.
 *   4. Supabase Storage'a yazar, peaker_jobs_log.result jsonb'ya storagePath.
 *   5. notifications insert ile kullanıcıya hazır bildirimi.
 *
 * Sınırlamalar:
 *   - Bu turda yalnızca modern schema desteği var. Eski schema'da (Faz 1-2
 *     migration'lar uygulanmamış) handler hata fırlatır → DLQ. Sync path
 *     hâlâ multi-strategy fallback ile çalışır; async opt-in.
 *   - Hard cap = 10000 sync ile aynı.
 *
 * Idempotency:
 *   - storage upsert=true; aynı path overwrite.
 *   - peaker_jobs_log.idempotency_key unique; worker mark_running guard.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { csvFilename } from "@/lib/export/csv";
import { buildCsvFromRows } from "@/lib/export/csvStream";
import { logger } from "@/lib/monitoring/logger";
import { toDisplayName } from "@/lib/profile/displayName";
import {
  getAccountingPaymentKindLabel,
  getAccountingPaymentScopeLabel,
  getAccountingPaymentStatusLabel,
} from "@/lib/accountingFinance/labels";
import type { WorkerHandler, WorkerHandlerResult, WorkerJobContext } from "./types";

const PAYMENTS_EXPORT_HARD_CAP = 10000;

type PaymentRowDb = {
  id: string;
  athlete_id: string | null;
  amount: number | string | null;
  paid_amount: number | string | null;
  payment_date: string | null;
  due_date: string | null;
  status: "bekliyor" | "odendi" | null;
  payment_kind: string | null;
  payment_scope: string | null;
  description: string | null;
  channel: string | null;
  source_label: string | null;
  package_id: string | null;
  deleted_at: string | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

type ExportPaymentsPayloadAttributes = {
  organizationId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  paymentStatus?: "all" | "bekliyor" | "odendi";
  paymentKind?: string | null;
  initiatorUserId?: string | null;
};

function extractAttributes(ctx: WorkerJobContext): ExportPaymentsPayloadAttributes {
  const attrs = (ctx.payload?.attributes as Record<string, unknown> | undefined) ?? {};
  const status = typeof attrs.paymentStatus === "string" ? attrs.paymentStatus : "all";
  return {
    organizationId:
      typeof attrs.organizationId === "string" ? attrs.organizationId : ctx.organizationId,
    dateFrom: typeof attrs.dateFrom === "string" ? attrs.dateFrom : null,
    dateTo: typeof attrs.dateTo === "string" ? attrs.dateTo : null,
    paymentStatus: (status === "bekliyor" || status === "odendi" ? status : "all") as
      | "all"
      | "bekliyor"
      | "odendi",
    paymentKind: typeof attrs.paymentKind === "string" ? attrs.paymentKind : null,
    initiatorUserId: typeof attrs.initiatorUserId === "string" ? attrs.initiatorUserId : null,
  };
}

function formatTrDate(iso: string | null): string {
  if (!iso) return "";
  const dateOnly = iso.length >= 10 ? iso.slice(0, 10) : iso;
  if (!/^\d{4}-\d{2}-\d{2}/.test(dateOnly)) return iso;
  const [y, m, d] = dateOnly.split("-");
  return `${d}.${m}.${y}`;
}

export const exportPaymentsHandler: WorkerHandler = {
  kind: "export.payments",
  async run(ctx: WorkerJobContext): Promise<WorkerHandlerResult> {
    const attrs = extractAttributes(ctx);
    if (!attrs.organizationId) {
      throw new Error("export.payments requires organizationId in payload");
    }
    if (!attrs.dateFrom || !attrs.dateTo) {
      throw new Error("export.payments requires dateFrom and dateTo (YYYY-MM-DD)");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(attrs.dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(attrs.dateTo)) {
      throw new Error("export.payments dateFrom/dateTo must be YYYY-MM-DD");
    }
    if (attrs.dateFrom > attrs.dateTo) {
      throw new Error("export.payments dateFrom > dateTo");
    }

    const adminClient = createSupabaseAdminClient();
    const fromIso = new Date(`${attrs.dateFrom}T00:00:00.000Z`).toISOString();
    const toExclusiveIso = new Date(
      new Date(`${attrs.dateTo}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000
    ).toISOString();

    let q = adminClient
      .from("payments")
      .select(
        "id, athlete_id, amount, paid_amount, payment_date, due_date, status, payment_kind, payment_scope, description, channel, source_label, package_id, deleted_at, profiles!athlete_id(full_name, email)"
      )
      .eq("organization_id", attrs.organizationId)
      .is("deleted_at", null)
      .gte("payment_date", fromIso)
      .lt("payment_date", toExclusiveIso)
      .order("payment_date", { ascending: false })
      .limit(PAYMENTS_EXPORT_HARD_CAP);

    if (attrs.paymentStatus !== "all") q = q.eq("status", attrs.paymentStatus);
    if (attrs.paymentKind) q = q.eq("payment_kind", attrs.paymentKind);

    const { data, error } = await q;
    if (error) {
      const err = new Error(`payments query failed: ${error.message}`);
      (err as Error & { errorKind?: string }).errorKind = "fetch_error";
      throw err;
    }

    const rows = (data ?? []) as PaymentRowDb[];
    const headers = [
      "Tahsilat Tarihi",
      "Vade Tarihi",
      "Sporcu",
      "Durum",
      "Tutar (TL)",
      "Ödenen (TL)",
      "Kalan (TL)",
      "Ödeme Türü",
      "Kapsam",
      "Açıklama",
      "Kanal",
      "Kaynak",
      "Paket ID",
    ];
    const csvRows: ReadonlyArray<unknown>[] = rows.map((p) => {
      const amount = Number(p.amount ?? 0) || 0;
      const paidAmount = Number(p.paid_amount ?? 0) || 0;
      const remaining = p.status === "odendi" ? amount - paidAmount : null;
      const athleteName = toDisplayName(
        p.profiles?.full_name ?? null,
        p.profiles?.email ?? null,
        "Sporcu"
      );
      return [
        formatTrDate(p.payment_date),
        formatTrDate(p.due_date),
        athleteName,
        getAccountingPaymentStatusLabel((p.status ?? "bekliyor") as "bekliyor" | "odendi"),
        amount,
        paidAmount,
        remaining != null ? remaining : "",
        getAccountingPaymentKindLabel(p.payment_kind),
        getAccountingPaymentScopeLabel(p.payment_scope),
        String(p.description ?? ""),
        String(p.channel ?? ""),
        String(p.source_label ?? ""),
        p.package_id ?? "",
      ];
    });
    const built = buildCsvFromRows(headers, csvRows, { maxRows: PAYMENTS_EXPORT_HARD_CAP });
    const truncated = built.truncated || rows.length >= PAYMENTS_EXPORT_HARD_CAP;

    const filename = csvFilename("muhasebe", "tahsilat", {
      from: attrs.dateFrom,
      to: attrs.dateTo,
      status: attrs.paymentStatus === "all" ? null : attrs.paymentStatus,
    });
    const storagePath = `${attrs.organizationId}/${ctx.logId}/${filename}`;

    const csvBytes = new TextEncoder().encode(built.csv);
    const { error: uploadError } = await adminClient.storage
      .from("peaker-job-exports")
      .upload(storagePath, csvBytes, {
        contentType: "text/csv; charset=utf-8",
        upsert: true,
        cacheControl: "300",
      });
    if (uploadError) {
      const err = new Error(`storage upload failed: ${uploadError.message}`);
      (err as Error & { errorKind?: string }).errorKind = "fetch_error";
      throw err;
    }

    if (attrs.initiatorUserId) {
      const message = `Tahsilat dışa aktarımınız hazır: ${built.rowCount} satır${
        truncated ? ` (cap ${PAYMENTS_EXPORT_HARD_CAP} aşıldı)` : ""
      }.`;
      const { error: notifyError } = await adminClient
        .from("notifications")
        .insert({ user_id: attrs.initiatorUserId, message });
      if (notifyError) {
        logger.warn("worker.export.payments", "notification insert failed (non-fatal)", {
          jobLogId: ctx.logId,
          reason: notifyError.message,
        });
      }
    }

    logger.info("worker.export.payments", "csv built and uploaded", {
      jobLogId: ctx.logId,
      organizationId: attrs.organizationId,
      rowCount: built.rowCount,
      truncated,
      storagePath,
    });

    return {
      storagePath,
      rowCount: built.rowCount,
      truncated,
      summary: {
        filename,
        cap: PAYMENTS_EXPORT_HARD_CAP,
        bytes: csvBytes.byteLength,
      },
    };
  },
};
