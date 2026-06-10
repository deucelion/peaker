import { describe, expect, it } from "vitest";
import { scanTenantScopeCounts } from "./tenantScopeScan";

/**
 * FAZ 31: Tenant scope tripwire.
 *
 * Baseline'daki her kayıt, FAZ 31 denetiminde tek tek incelenmiş ve güvenli
 * bulunmuş sorgulardır (org doğrulaması sorgudan önce yapılıyor, id'ler
 * org-scoped ön sorgudan türetiliyor veya sorgu aktörün kendi satırıyla
 * sınırlı — denetim raporu: Faz 31, Haziran 2026).
 *
 * Bu test şunu zorlar: bir aksiyon dosyasına organization_id/org_id filtresi
 * olmayan YENİ bir tenant tablosu sorgusu eklenirse sayı artar ve test kırılır.
 * Yeni sorgu gerçekten güvenliyse (org doğrulaması sorgudan önce yapılıyorsa)
 * baseline'ı gerekçesiyle birlikte güncelleyin; değilse sorguya org kapsamı
 * ekleyin.
 */
const AUDITED_BASELINE: Record<string, number> = {
  // Aktörün kendi satırı (actor.id) — self-scoped
  "src/lib/actions/athleteCalendarActions.ts :: athlete_permissions": 1,
  // L85-94 profil + org gate sorgudan önce (athleteId org doğrulanır)
  "src/lib/actions/athleteDetailActions.ts :: athlete_metrics": 1,
  "src/lib/actions/athleteDetailActions.ts :: athletic_results": 1,
  "src/lib/actions/athleteDetailActions.ts :: training_loads": 1,
  "src/lib/actions/athleteDetailActions.ts :: wellness_reports": 1,
  // athleteIds org-filtreli profiles sorgusundan türetilir
  "src/lib/actions/athletePermissionActions.ts :: athlete_permissions": 1,
  // resolveFieldTestActor + org-scoped profil/metrik ön doğrulaması; orgShape
  // koşullu organization_id/org_id filtreleri buildQuery içinde eklenir
  "src/lib/actions/athleticFieldActions.ts :: athletic_results": 7,
  "src/lib/actions/athleticFieldActions.ts :: test_definitions": 5,
  // trainingId canManageTraining ile org-scoped; profileId org-filtreli profiles
  "src/lib/actions/attendanceActions.ts :: training_participants": 3,
  // coachId getCoachProfileRowForOrgAdmin ile org doğrulanır (PK satır)
  "src/lib/actions/coachActions.ts :: coach_permissions": 1,
  // duplicate-email yolu: sonuç org kontrolünden geçer, jenerik hata mesajı (Faz 31)
  "src/lib/actions/coachActions.ts :: profiles": 1,
  // Sporcunun kendi izin satırı / org-doğrulanmış athleteId ile insert payload
  "src/lib/actions/financeActions.ts :: athlete_permissions": 1,
  "src/lib/actions/financeActions.ts :: payments": 1,
  // user_id = actor.id self-scope; training_id org-scoped lesson lookup'tan
  "src/lib/actions/lessonActions.ts :: notifications": 1,
  "src/lib/actions/lessonActions.ts :: training_participants": 10,
  // Faz 31 düzeltmesi: org profil id listesi + chunked .in("profile_id")
  "src/lib/actions/managementDirectoryActions.ts :: training_loads": 1,
  // sessionClient (RLS aktif) + user_id self-scope
  "src/lib/actions/notificationActions.ts :: notifications": 1,
  // profileIds org-filtreli profiles sorgusundan, chunked .in
  "src/lib/actions/performanceAnalyticsActions.ts :: training_loads": 2,
  "src/lib/actions/performanceAnalyticsActions.ts :: wellness_reports": 1,
  // athleteId/packageId org-scoped ön doğrulama; insert payload org damgalı
  "src/lib/actions/privateLessonPackageActions.ts :: private_lesson_packages": 1,
  "src/lib/actions/privateLessonPackageActions.ts :: private_lesson_payments": 1,
  "src/lib/actions/privateLessonSessionActions.ts :: private_lesson_sessions": 1,
  // sessionClient + actor.id self-scope
  "src/lib/actions/programActions.ts :: athlete_permissions": 1,
  // actor.id / org-doğrulanmış profile.id / org-scoped lessonIds
  "src/lib/actions/snapshotActions.ts :: athlete_metrics": 1,
  "src/lib/actions/snapshotActions.ts :: athlete_permissions": 2,
  "src/lib/actions/snapshotActions.ts :: notifications": 1,
  "src/lib/actions/snapshotActions.ts :: payments": 1,
  "src/lib/actions/snapshotActions.ts :: training_participants": 4,
  // resolveAthleteForSurvey: sporcu rolü + kendi kaydı (actor.id)
  "src/lib/actions/trainingLoadSurveyActions.ts :: athlete_permissions": 1,
  "src/lib/actions/trainingLoadSurveyActions.ts :: training_loads": 3,
  // auth user id + org-doğrulanmış kendi profili
  "src/lib/actions/wellnessFormActions.ts :: athlete_permissions": 3,
};

describe("FAZ 31: tenant scope audit", () => {
  it("org filtresi olmayan service-role sorgulari denetlenmis baseline ile sinirli", () => {
    const counts = scanTenantScopeCounts();
    const actual: Record<string, number> = {};
    for (const [key, value] of [...counts.entries()].sort()) {
      actual[key] = value;
    }

    const messages: string[] = [];
    for (const [key, count] of Object.entries(actual)) {
      const allowed = AUDITED_BASELINE[key] ?? 0;
      if (count > allowed) {
        messages.push(
          `YENİ kapsamsız sorgu: ${key} (baseline ${allowed}, şimdi ${count}) — org doğrulamasını ekleyin veya denetleyip baseline'ı güncelleyin.`
        );
      }
    }
    for (const [key, allowed] of Object.entries(AUDITED_BASELINE)) {
      const count = actual[key] ?? 0;
      if (count < allowed) {
        messages.push(
          `Baseline güncel değil: ${key} (baseline ${allowed}, şimdi ${count}) — baseline'ı düşürün.`
        );
      }
    }

    expect(messages, messages.join("\n")).toEqual([]);
  });
});
