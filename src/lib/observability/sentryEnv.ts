/**
 * Sentry: DSN + açık/kapalı bayrağı.
 * - DSN yoksa SDK başlatılmaz (no-op).
 * - NEXT_PUBLIC_SENTRY_ENABLED=0 | false ile DSN olsa bile kapalı.
 */

function trimEnv(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t || undefined;
}

export function isSentryExplicitlyDisabled(): boolean {
  const v = trimEnv(process.env.NEXT_PUBLIC_SENTRY_ENABLED)?.toLowerCase();
  return v === "0" || v === "false" || v === "off" || v === "no";
}

/** İstemci ve sunucu için genelde NEXT_PUBLIC_SENTRY_DSN; sunucuda isteğe bağlı SENTRY_DSN yedek. */
export function getSentryDsn(): string | undefined {
  return trimEnv(process.env.NEXT_PUBLIC_SENTRY_DSN) ?? trimEnv(process.env.SENTRY_DSN);
}

export function isSentryRuntimeEnabled(): boolean {
  if (isSentryExplicitlyDisabled()) return false;
  return Boolean(getSentryDsn());
}

export function getSentryEnvironment(): string | undefined {
  return (
    trimEnv(process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT) ??
    trimEnv(process.env.SENTRY_ENVIRONMENT) ??
    trimEnv(process.env.VERCEL_ENV) ??
    (process.env.NODE_ENV === "production" ? "production" : undefined)
  );
}
