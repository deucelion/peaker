/**
 * Faz 8.1 — Server-side aggregation helpers.
 *
 * Hedef:
 *   - Performans analytics query'lerini büyük organizasyonlarda güvenli kılmak.
 *   - Davranışı değiştirmeden gözlemlenebilirlik + cap eklemek.
 *   - Helper'lar pure / testable; gerçek Supabase çağrısı içermez.
 *
 * Mevcut hotspot:
 *   `listPerformanceAnalyticsData` team view'da `.in("profile_id", profileIds[])`
 *   ile tüm org sporcuları üzerinden `training_loads` çeker. Profil join'i
 *   takım görünümünde kullanılmaz; gereksiz payload.
 */

import { logger } from "@/lib/monitoring";

/**
 * Org-wide eş zamanlı yüklenebilecek azami sporcu sayısı.
 * Bu cap'in üstüne çıkıldığında query bölünmez (davranış parity), sadece
 * structured log yazılır. Faz 9'da chunking eklenebilir.
 */
export const PROFILE_LOAD_FETCH_SOFT_CAP = 500;
export const PROFILE_LOAD_FETCH_HARD_CAP = 1000;

export type ProfileFetchPlan = {
  profileIds: string[];
  needsProfileJoin: boolean;
  overSoftCap: boolean;
  cappedAtHard: boolean;
};

/**
 * Verilen profile id listesini cap'ler ve telemetry üretir.
 *
 * - `needsProfileJoin`: tek sporcu görünümünde profil join'i gerekli (display name);
 *   takım görünümünde aggregateTrainingLoadsByCalendarDay sonrası profiles
 *   `null`'a düşürüldüğünden gereksizdir.
 * - Soft cap aşılırsa warn log; hard cap aşılırsa kesme + warn log.
 */
export function planProfileLoadFetch(
  profileIds: string[],
  options: { mode: "team" | "single"; scope: string }
): ProfileFetchPlan {
  const unique = Array.from(new Set(profileIds.filter(Boolean)));
  const overSoft = unique.length > PROFILE_LOAD_FETCH_SOFT_CAP;
  const overHard = unique.length > PROFILE_LOAD_FETCH_HARD_CAP;
  const capped = overHard ? unique.slice(0, PROFILE_LOAD_FETCH_HARD_CAP) : unique;
  if (overHard) {
    logger.warn(
      `performance.profileFetch.cap`,
      `profile id list exceeded hard cap (${unique.length} → ${PROFILE_LOAD_FETCH_HARD_CAP})`,
      {
        scope: options.scope,
        mode: options.mode,
        original: unique.length,
        cap: PROFILE_LOAD_FETCH_HARD_CAP,
      }
    );
  } else if (overSoft) {
    logger.warn(
      `performance.profileFetch.soft_cap`,
      `profile id list exceeded soft cap`,
      {
        scope: options.scope,
        mode: options.mode,
        original: unique.length,
        softCap: PROFILE_LOAD_FETCH_SOFT_CAP,
      }
    );
  }
  return {
    profileIds: capped,
    needsProfileJoin: options.mode === "single",
    overSoftCap: overSoft,
    cappedAtHard: overHard,
  };
}

/**
 * Training loads için narrow select column'ları üretir.
 * Davranış parity: takım görünümünde `profiles(...)` join'i atlanır
 * (mevcut `aggregateTrainingLoadsByCalendarDay` sonrası zaten `null`'lanıyor).
 */
export function trainingLoadsSelectClause(needsProfileJoin: boolean): string {
  return needsProfileJoin
    ? "profile_id, total_load, rpe_score, measurement_date, profiles(full_name, email)"
    : "profile_id, total_load, rpe_score, measurement_date";
}
