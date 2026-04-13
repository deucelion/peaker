/**
 * Yalnızca `next.config.ts` tarafından yüklenir (Edge / instrumentation ile paylaşılmaz).
 * `npm run build` sırasında zorunlu env eksikse derlemeyi durdurur.
 */
export function assertPeakerBuildEnv(): void {
  if (process.env.npm_lifecycle_event !== "build") return;
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) {
    throw new Error(`Peaker: next build icin ortam degiskenleri eksik: ${missing.join(", ")}`);
  }
}
