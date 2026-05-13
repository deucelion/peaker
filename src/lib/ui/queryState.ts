/**
 * Faz 7.3 — Query lifecycle standardization.
 *
 * Tüm dashboard sayfalarında "loading / error / empty / refreshing / stale"
 * durumlarını aynı semantik ile yönetmek için ortak helper'lar.
 *
 * Üç temel kavram:
 *   1. ErrorKind   → server action'ların döndürdüğü hata sınıfları
 *      ("permission_denied" | "auth_required" | "invalid_input" | "fetch_error")
 *   2. QueryStatus → UI render branch ("idle" | "loading" | "refreshing" | "ready" | "empty" | "error")
 *   3. ToneClass   → konuya göre renk paleti
 *      - amber: permission / auth issue
 *      - red: fetch / runtime failure
 *      - gray: empty / no data
 *      - purple: refreshing
 *
 * Page-level hook'lar bu helper'ları kullanarak page render'da
 * tek branch ile doğru UI'a yönlendirebilir.
 */

export type QueryErrorKind =
  | "permission_denied"
  | "auth_required"
  | "invalid_input"
  | "fetch_error";

export type QueryStatus = "idle" | "loading" | "refreshing" | "ready" | "empty" | "error";

export type QueryToneKey = "amber" | "red" | "gray" | "purple" | "emerald";

export const QUERY_TONE_CLASS: Record<QueryToneKey, string> = {
  amber: "border-amber-400/30 bg-amber-500/10 text-amber-100",
  red: "border-red-400/30 bg-red-500/10 text-red-100",
  gray: "border-white/10 bg-white/[0.04] text-gray-300",
  purple: "border-[#7c3aed]/30 bg-[#7c3aed]/10 text-[#c4b5fd]",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
};

/**
 * UI panellerinde tutarlı erişim semantiği için error→ton eşlemesi.
 * - permission_denied / auth_required → amber (kullanıcı eylemi)
 * - invalid_input → amber (parametre düzeltmesi)
 * - fetch_error → red (sistem hatası, retry önerisi)
 */
export function toneForErrorKind(kind: QueryErrorKind | null | undefined): QueryToneKey {
  switch (kind) {
    case "permission_denied":
    case "auth_required":
    case "invalid_input":
      return "amber";
    case "fetch_error":
      return "red";
    default:
      return "red";
  }
}

/**
 * "isLoading" gibi tek bayrak yerine status semantiği.
 * - loading: ilk render, henüz veri yok
 * - refreshing: veri var, arkadan yeniden çekiliyor
 * - error: yükleme başarısız
 * - empty: yüklendi ama veri yok
 * - ready: yüklendi, veri var
 */
export function deriveQueryStatus(args: {
  loading: boolean;
  refreshing?: boolean;
  hasError: boolean;
  hasData: boolean;
}): QueryStatus {
  if (args.hasError) return "error";
  if (args.loading && !args.hasData) return "loading";
  // `loading=true` with cached data, or explicit `refreshing=true` → refreshing
  if (args.refreshing || (args.loading && args.hasData)) return "refreshing";
  if (!args.hasData) return "empty";
  return "ready";
}

/**
 * Standart Türkçe hata başlığı (sayfa banner'larında kullanılır).
 */
export function defaultErrorTitle(kind: QueryErrorKind | null | undefined): string {
  switch (kind) {
    case "permission_denied":
      return "Bu alanı görüntüleme yetkiniz yok.";
    case "auth_required":
      return "Oturumunuz sona ermiş. Yeniden giriş yapın.";
    case "invalid_input":
      return "Parametreler hatalı. Filtreleri kontrol edin.";
    case "fetch_error":
      return "Veriler alınamadı.";
    default:
      return "Beklenmeyen bir hata oluştu.";
  }
}

/**
 * Standart retry önerisi (fetch_error için). Diğer kind'larda boş döner.
 */
export function defaultRetryHint(kind: QueryErrorKind | null | undefined): string | null {
  if (kind === "fetch_error") return "Bir süre sonra tekrar deneyin veya sayfayı yenileyin.";
  return null;
}

/**
 * Pagination clamp helper (server-side ile aynı semantiği client'a taşır).
 */
export function clampPagination(page: number, pageSize: number, maxPageSize = 200) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), maxPageSize) : 50;
  return { page: safePage, pageSize: safeSize };
}

/**
 * `errorKind` string'i runtime'da güvenli şekilde daraltır.
 * Server action'ın `errorKind` döndürdüğü değer beklenenden farklıysa
 * (örn. yeni bir kategori), `fetch_error`'a düşer (en güvenli default).
 */
export function normalizeErrorKind(value: unknown): QueryErrorKind {
  if (
    value === "permission_denied" ||
    value === "auth_required" ||
    value === "invalid_input" ||
    value === "fetch_error"
  ) {
    return value;
  }
  return "fetch_error";
}
