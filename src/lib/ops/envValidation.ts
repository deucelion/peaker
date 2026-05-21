/**
 * FAZ 27 — Production environment validation (no secret values logged).
 */

export type EnvCheckSeverity = "required" | "recommended" | "optional";

export type EnvCheckResult = {
  key: string;
  ok: boolean;
  severity: EnvCheckSeverity;
  message: string;
};

export type EnvValidationReport = {
  ok: boolean;
  isProduction: boolean;
  checks: EnvCheckResult[];
  missingRequired: string[];
};

function has(key: string): boolean {
  const v = process.env[key];
  return typeof v === "string" && v.trim().length > 0;
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateProductionEnv(): EnvValidationReport {
  const isProduction = process.env.NODE_ENV === "production";
  const checks: EnvCheckResult[] = [];

  const add = (key: string, severity: EnvCheckSeverity, ok: boolean, message: string) => {
    checks.push({ key, severity, ok, message });
  };

  add(
    "NEXT_PUBLIC_SUPABASE_URL",
    "required",
    has("NEXT_PUBLIC_SUPABASE_URL") &&
      isValidUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()),
    "Supabase proje URL (https)"
  );
  add("NEXT_PUBLIC_SUPABASE_ANON_KEY", "required", has("NEXT_PUBLIC_SUPABASE_ANON_KEY"), "Anon key");
  add("SUPABASE_SERVICE_ROLE_KEY", "required", has("SUPABASE_SERVICE_ROLE_KEY"), "Service role (server only)");

  const queueAdapter = process.env.PEAKER_QUEUE_ADAPTER?.trim();
  if (queueAdapter === "pgmq") {
    add("WORKER_SHARED_SECRET", "required", has("WORKER_SHARED_SECRET"), "Worker cron secret (pgmq)");
  } else {
    add("WORKER_SHARED_SECRET", "recommended", has("WORKER_SHARED_SECRET"), "Worker secret (queue aktifse)");
  }

  add(
    "NEXT_PUBLIC_SENTRY_DSN",
    "recommended",
    has("NEXT_PUBLIC_SENTRY_DSN"),
    "Sentry DSN (önerilir)"
  );

  add("PEAKER_RATE_LIMIT_BACKEND", "optional", true, queueAdapter ? `Queue: ${queueAdapter}` : "Queue: memory (default)");

  const missingRequired = checks.filter((c) => c.severity === "required" && !c.ok).map((c) => c.key);
  const ok = missingRequired.length === 0;

  return { ok, isProduction, checks, missingRequired };
}
