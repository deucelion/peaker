/**
 * Production Node sunucusu ayaga kalkarken kritik env kontrolu.
 * - `next build` sirasinda calismaz (NEXT_PHASE).
 * - Public Supabase degiskenleri yoksa: hata (uygulama calisamaz).
 * - Service role: production'da zorunlu (admin client, profil onarimi).
 */

const PUBLIC_REQUIRED = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

export function runProductionEnvGate(): void {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NODE_ENV !== "production") return;

  const missingPublic = PUBLIC_REQUIRED.filter((k) => !process.env[k]?.trim());
  if (missingPublic.length > 0) {
    throw new Error(
      `Peaker: Production icin zorunlu ortam degiskenleri eksik veya bos: ${missingPublic.join(", ")}`
    );
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) {
    throw new Error(
      "Peaker: SUPABASE_SERVICE_ROLE_KEY eksik — org gate admin fallback ve service-role profil onarimi calismaz."
    );
  }
}
