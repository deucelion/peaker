/**
 * Faz 12.1 — Worker tick HTTP endpoint.
 *
 * Çağıran:
 *   - Vercel Cron (production): `vercel.json` crons entry her dakika.
 *   - Supabase pg_cron + pg_net (alternatif): DB tarafından her dakika HTTP POST.
 *   - Manual (smoke testi): `curl -X POST -H "X-Worker-Token: ..." /api/jobs/process`
 *
 * Güvenlik:
 *   - `WORKER_SHARED_SECRET` env zorunlu; header `X-Worker-Token` eşleşmeli.
 *   - Eşleşmeyen istek → 401.
 *   - Body bilgisi alınmaz; gerekirse query param `?batchSize=` ile özelleştirilebilir.
 *
 * Behavior:
 *   - Tek runWorkerTick çağrısı yapar; sonucu JSON döner.
 *   - 200 OK: tick tamamlandı (mesaj yoksa bile).
 *   - 503 Service Unavailable: pgmq erişilemez (migration uygulanmamış).
 *   - 500: beklenmeyen runtime hatası.
 */

import { NextResponse } from "next/server";
import { runWorkerTick, type WorkerTickOptions } from "@/lib/jobs/worker";
import { ensureQueueAdapterSetup } from "@/lib/jobs/setupQueueAdapter";
import { ensureRateLimitSetup } from "@/lib/rateLimit";
import { logger } from "@/lib/monitoring/logger";

// Cold start'ta queue ve rate-limit adapter'ları bir kez initialize et.
ensureQueueAdapterSetup();
ensureRateLimitSetup();

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WORKER_TOKEN_HEADER = "x-worker-token";
const BEARER_PREFIX = "Bearer ";

function readWorkerToken(request: Request): string | null {
  // 1) Custom header (pg_net / manuel curl).
  const direct = request.headers.get(WORKER_TOKEN_HEADER);
  if (direct && direct.length > 0) return direct;
  // 2) Authorization: Bearer <token> (Vercel Cron pattern).
  const auth = request.headers.get("authorization");
  if (auth && auth.startsWith(BEARER_PREFIX)) {
    const token = auth.slice(BEARER_PREFIX.length).trim();
    if (token.length > 0) return token;
  }
  return null;
}

function clampNumberParam(
  value: string | null,
  min: number,
  max: number,
  fallback: number
): number {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export async function POST(request: Request) {
  const secret = process.env.WORKER_SHARED_SECRET;
  if (!secret || secret.trim().length === 0) {
    logger.warn("worker.route", "WORKER_SHARED_SECRET missing; refusing");
    return NextResponse.json(
      { error: "Worker shared secret yapılandırılmamış." },
      { status: 503 }
    );
  }

  const provided = readWorkerToken(request);
  if (provided !== secret) {
    logger.warn("worker.route", "invalid worker token", {
      hasHeader: Boolean(provided),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const opts: WorkerTickOptions = {
    batchSize: clampNumberParam(url.searchParams.get("batchSize"), 1, 50, 10),
    visibilitySeconds: clampNumberParam(
      url.searchParams.get("visibilitySeconds"),
      10,
      300,
      60
    ),
    softDeadlineMs: clampNumberParam(
      url.searchParams.get("softDeadlineMs"),
      1000,
      55_000,
      50_000
    ),
    source: (url.searchParams.get("source") as WorkerTickOptions["source"]) ?? "vercel_cron",
  };

  try {
    const result = await runWorkerTick(opts);
    if (!result.pgmqAvailable) {
      return NextResponse.json(
        {
          ok: false,
          reason: result.reason ?? "pgmq unavailable",
          result,
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    logger.error("worker.route", err, {});
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  // Sağlık / smoke testi için GET izinli ama yine token gerekli ve hiç iş yapmaz.
  const secret = process.env.WORKER_SHARED_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "secret_missing" }, { status: 503 });
  }
  const provided = readWorkerToken(request);
  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, hint: "POST to run a tick" }, { status: 200 });
}
