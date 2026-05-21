"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CircleDollarSign,
  History,
  Loader2,
  Pause,
  Play,
  XCircle,
} from "lucide-react";
import {
  cancelPrivateLessonPackage,
  freezePrivateLessonPackage,
  refundPrivateLessonPackage,
  resumePrivateLessonPackage,
} from "@/lib/actions/privateLessonPackageLifecycleActions";
import { formatCurrencyTRY } from "@/lib/privateLessons/packageMath";
import {
  PACKAGE_EVENT_LABEL_TR,
  type PackageEventType,
} from "@/lib/privateLessons/packageEventTypes";
import {
  PACKAGE_LIFECYCLE_LABEL,
  PACKAGE_LIFECYCLE_TONE,
  canCancelPackage,
  canFreezePackage,
  canRefundPackage,
  canResumePackage,
  type PackageLifecycleStatus,
} from "@/lib/privateLessons/packageStatus";
import type {
  PrivateLessonPackage,
  PrivateLessonPackageDetailSnapshot,
  PrivateLessonPackageEventRow,
} from "@/lib/types";

const formatTry = formatCurrencyTRY;

function EventIcon({ type }: { type: string }) {
  if (type.includes("payment")) return <CircleDollarSign size={14} aria-hidden />;
  if (type.includes("paused")) return <Pause size={14} aria-hidden />;
  if (type.includes("resumed")) return <Play size={14} aria-hidden />;
  if (type.includes("cancelled") || type.includes("refunded")) return <XCircle size={14} aria-hidden />;
  return <History size={14} aria-hidden />;
}

type Props = {
  pkg: PrivateLessonPackage;
  snapshot: Pick<
    PrivateLessonPackageDetailSnapshot,
    "financeSummary" | "eventRows" | "usageLessonRows"
  >;
  canManage: boolean;
  onRefresh: () => void;
};

export function PackageLifecycleBanner({ status }: { status: PackageLifecycleStatus }) {
  if (status === "active" || status === "completed") return null;
  const copy: Record<string, string> = {
    paused: "Paket donduruldu. Ders planlama ve kullanım kapalı; tahsilat kaydı eklenebilir.",
    cancelled: "Paket iptal edildi. Yeni ödeme ve ders işlemi yapılamaz.",
    refunded: "Paket iade edildi. Finansal olarak kapatıldı; yeni işlem yapılamaz.",
  };
  const tone =
    status === "paused"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
      : "border-rose-500/40 bg-rose-500/10 text-rose-100";
  return (
    <div className={`flex gap-3 rounded-xl border p-4 text-xs font-semibold ${tone}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>{copy[status]}</p>
    </div>
  );
}

export function PackageLifecycleActions({ pkg, canManage, onRefresh }: Omit<Props, "snapshot">) {
  const status = pkg.lifecycleStatus;
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "refund" | null>(null);
  const [reason, setReason] = useState("");

  async function run(action: () => Promise<{ success?: true; error?: string }>, key: string) {
    setBusy(key);
    const res = await action();
    setBusy(null);
    if ("error" in res && res.error) {
      window.alert(res.error);
      return;
    }
    setConfirm(null);
    setReason("");
    onRefresh();
  }

  if (!canManage) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {canFreezePackage(status) && (
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void run(() => freezePrivateLessonPackage(pkg.id), "freeze")}
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-200"
        >
          {busy === "freeze" ? <Loader2 className="inline h-3 w-3 animate-spin" /> : "Dondur"}
        </button>
      )}
      {canResumePackage(status) && (
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void run(() => resumePrivateLessonPackage(pkg.id), "resume")}
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-200"
        >
          Aktif et
        </button>
      )}
      {canCancelPackage(status) && (
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => setConfirm("cancel")}
          className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300"
        >
          İptal
        </button>
      )}
      {canRefundPackage(status) && status !== "refunded" && (
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => setConfirm("refund")}
          className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-200"
        >
          İade
        </button>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121215] p-5">
            <h3 className="text-sm font-black uppercase tracking-widest text-white">
              {confirm === "cancel" ? "Paketi iptal et" : "Paketi iade et"}
            </h3>
            <p className="mt-2 text-xs text-gray-400">Bu işlem geri alınamaz. Devam etmek istiyor musunuz?</p>
            <textarea
              className="mt-3 min-h-[4rem] w-full rounded-xl border border-white/10 bg-[#0d0d11] p-3 text-sm text-white"
              placeholder="Not (isteğe bağlı)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirm(null)} className="px-3 py-2 text-xs text-gray-400">
                Vazgeç
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() =>
                  void run(
                    () =>
                      confirm === "cancel"
                        ? cancelPrivateLessonPackage(pkg.id, reason)
                        : refundPrivateLessonPackage(pkg.id, reason),
                    confirm
                  )
                }
                className="rounded-lg bg-rose-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white"
              >
                Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PackageFinanceCards({ pkg, snapshot }: Pick<Props, "pkg" | "snapshot">) {
  const f = snapshot.financeSummary;
  const lessonPct =
    pkg.totalLessons > 0 ? Math.min(100, Math.round((pkg.usedLessons / pkg.totalLessons) * 100)) : 0;
  const payPct = f.totalPrice > 0 ? Math.min(100, Math.round((f.amountPaid / f.totalPrice) * 100)) : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Finans özeti</p>
        <p className="mt-2 text-lg font-black text-white">{formatTry(f.totalPrice)}</p>
        <p className="text-xs text-gray-400">
          Ödenmesi gereken: {formatTry(f.totalPrice)} · Alınan: {formatTry(f.amountPaid)} · Kalan:{" "}
          {formatTry(f.remainingBalance)}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${payPct}%` }} />
        </div>
        {f.paymentComplete && (
          <span className="mt-2 inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-200">
            Tahsilat tamamlandı
          </span>
        )}
        {f.installmentOverdue && (
          <p className="mt-2 text-[10px] font-semibold text-amber-300">Gecikmiş taksit — sonraki vade geçti</p>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Ders kullanımı</p>
        <p className="mt-2 text-lg font-black text-white">
          {pkg.usedLessons} / {pkg.totalLessons}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-[#7c3aed] transition-all" style={{ width: `${lessonPct}%` }} />
        </div>
        <span
          className={`mt-2 inline-flex rounded-md border px-2 py-0.5 text-[9px] font-black uppercase ${PACKAGE_LIFECYCLE_TONE[pkg.lifecycleStatus]}`}
        >
          {PACKAGE_LIFECYCLE_LABEL[pkg.lifecycleStatus]}
        </span>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Taksit planı</p>
        {f.installmentCount ? (
          <p className="mt-2 text-sm font-bold text-white">
            {f.installmentCount} taksit · {f.installmentIntervalDays ?? "—"} gün aralık
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-500">Tanımlı değil</p>
        )}
        <p className="mt-1 text-xs text-gray-400">
          Ödeme sayısı: {f.paymentCount}
          {f.lastPaymentAt ? ` · Son: ${new Date(f.lastPaymentAt).toLocaleDateString("tr-TR")}` : ""}
        </p>
        {f.nextPaymentDueAt && (
          <p className="mt-1 text-xs text-gray-400">
            Sonraki vade: {new Date(f.nextPaymentDueAt).toLocaleDateString("tr-TR")}
          </p>
        )}
      </div>
    </div>
  );
}

type TimelineCardProps = Pick<Props, "snapshot" | "pkg">;

export function PackageEventTimelineCard({ snapshot, pkg }: TimelineCardProps) {
  const synth = useMemo((): PrivateLessonPackageEventRow | null => {
    const f = snapshot.financeSummary;
    if (!f.installmentOverdue || !f.nextPaymentDueAt) return null;
    const t = Date.parse(f.nextPaymentDueAt);
    if (!Number.isFinite(t)) return null;
    return {
      id: `synthetic-installment-due-${pkg.id}`,
      packageId: pkg.id,
      organizationId: pkg.organizationId,
      actorId: null,
      eventType: "installment_due_passed",
      title: "Taksit vadesi geçti (takip)",
      description: "Sonraki vade tarihi geçti; sistem online ödeme almaz — tahsilat kaydı manuel takip edilmelidir.",
      metadata: {},
      createdAt: new Date(t).toISOString(),
    };
  }, [snapshot.financeSummary, pkg.id, pkg.organizationId]);

  const rows = useMemo(() => {
    const base = [...snapshot.eventRows];
    if (synth) base.push(synth);
    return base.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [snapshot.eventRows, synth]);

  const resolveLabel = (ev: PrivateLessonPackageEventRow) => {
    if (ev.eventType === "installment_due_passed") return "Taksit vadesi geçti";
    return PACKAGE_EVENT_LABEL_TR[ev.eventType as PackageEventType] || ev.title;
  };
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Finansal hareketler</h3>
      {!rows.length ? (
        <p className="mt-4 text-sm text-gray-500">Henüz kayıt yok.</p>
      ) : (
        <ul className="relative mt-4 border-l border-white/10 pl-4">
          {rows.map((ev) => {
            const label = resolveLabel(ev);
            const titleDup =
              ev.title.trim().toLowerCase() === label.trim().toLowerCase() ||
              ev.title.trim().length === 0;
            const when = new Date(ev.createdAt).toLocaleString("tr-TR");
            return (
              <li key={ev.id} className="relative pb-6 pl-1 last:pb-0">
                <span
                  className="absolute -left-[1.125rem] top-1 flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-[#0d0d11] text-gray-300 shadow-sm"
                  aria-hidden
                >
                  <EventIcon type={ev.eventType} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black tabular-nums text-gray-500">{when}</p>
                  <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-[#c4b5fd]">{label}</p>
                  {!titleDup ? <p className="mt-1 text-xs font-semibold leading-snug text-white">{ev.title}</p> : null}
                  {ev.description ? (
                    <p className="mt-1 text-[11px] leading-relaxed text-gray-400">{ev.description}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function PackageUsedLessonsCard({ snapshot }: Pick<Props, "snapshot">) {
  const rows = snapshot.usageLessonRows;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Kullanılan dersler</h3>
      {!rows.length ? (
        <p className="mt-4 text-sm text-gray-500">Henüz ders kullanımı yok.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[11px]">
            <thead>
              <tr className="text-gray-500">
                <th className="pb-2 font-black uppercase tracking-widest">Tarih</th>
                <th className="pb-2">Sporcu</th>
                <th className="pb-2">Koç</th>
                <th className="pb-2">Ders</th>
                <th className="pb-2">Hak</th>
                <th className="pb-2">Katılım</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5 text-gray-300">
                  <td className="py-2">{new Date(r.usedAt).toLocaleString("tr-TR")}</td>
                  <td className="py-2">{r.athleteName}</td>
                  <td className="py-2">{r.coachName || "—"}</td>
                  <td className="py-2">{r.lessonTitle}</td>
                  <td className="py-2">{r.creditsUsed}</td>
                  <td className="py-2">{r.attendanceStatus || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
