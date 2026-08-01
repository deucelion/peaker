import { PATHS } from "@/lib/navigation/routeRegistry";
import { ENTITLEMENT_KEYS } from "../keys";
import type { EntitlementKey } from "../types";

/**
 * Org feature gate icin PATH → entitlement sozlesmesi.
 * Public/auth-info path'ler (login, org-durumu, hesap-durumu) haric tutulur.
 */
export const ROUTE_DYNAMIC_PATTERN_KEYS = {
  athleteManagementProfile: "route:athlete_management_profile",
  privateLessonPackageDetail: "route:private_lesson_package_detail",
} as const;

export type RouteDynamicPatternKey = (typeof ROUTE_DYNAMIC_PATTERN_KEYS)[keyof typeof ROUTE_DYNAMIC_PATTERN_KEYS];

export const ROUTE_DYNAMIC_PATTERN_PATHS = {
  [ROUTE_DYNAMIC_PATTERN_KEYS.athleteManagementProfile]: `${PATHS.sporcu}/:athleteId`,
  [ROUTE_DYNAMIC_PATTERN_KEYS.privateLessonPackageDetail]: `${PATHS.ozelDersPaketleri}/:packageId`,
} as const satisfies Record<RouteDynamicPatternKey, string>;

export const ROUTE_ENTITLEMENT_MAP = {
  [PATHS.superAdmin]: ENTITLEMENT_KEYS.core,
  [PATHS.sistemSaglik]: ENTITLEMENT_KEYS.core,
  [PATHS.sistemOperasyonlari]: ENTITLEMENT_KEYS.core,
  [PATHS.home]: ENTITLEMENT_KEYS.core,
  [PATHS.performans]: ENTITLEMENT_KEYS.insightPerformance,
  [PATHS.performansAyarlar]: ENTITLEMENT_KEYS.insightPerformance,
  [PATHS.performansWellnessDetay]: ENTITLEMENT_KEYS.insightWellnessArchive,
  [PATHS.sahaTestleri]: ENTITLEMENT_KEYS.insightFieldTests,
  [PATHS.sahaTestleriMetrikler]: ENTITLEMENT_KEYS.insightFieldTests,
  [PATHS.idmanRaporu]: ENTITLEMENT_KEYS.insightTrainingReports,
  [PATHS.oyuncular]: ENTITLEMENT_KEYS.core,
  [PATHS.sporcularYeni]: ENTITLEMENT_KEYS.core,
  [PATHS.takimlar]: ENTITLEMENT_KEYS.core,
  [PATHS.antrenmanYonetimi]: ENTITLEMENT_KEYS.core,
  [PATHS.dersler]: ENTITLEMENT_KEYS.core,
  [PATHS.haftalikDersProgrami]: ENTITLEMENT_KEYS.core,
  [PATHS.notlarHaftalikProgram]: ENTITLEMENT_KEYS.core,
  [PATHS.ozelDersPaketleri]: ENTITLEMENT_KEYS.privateLessons,
  [PATHS.finans]: ENTITLEMENT_KEYS.finance,
  [PATHS.muhasebeFinans]: ENTITLEMENT_KEYS.finance,
  [PATHS.tahsilatMerkezi]: ENTITLEMENT_KEYS.finance,
  [PATHS.sporcuFinans]: ENTITLEMENT_KEYS.finance,
  [PATHS.koclar]: ENTITLEMENT_KEYS.core,
  [PATHS.bildirimler]: ENTITLEMENT_KEYS.communications,
  [PATHS.anket]: ENTITLEMENT_KEYS.athlete,
  [PATHS.takvim]: ENTITLEMENT_KEYS.athlete,
  [PATHS.programlarim]: ENTITLEMENT_KEYS.athlete,
  [PATHS.ozelDersPaketlerim]: ENTITLEMENT_KEYS.privateLessons,
  [PATHS.sporcu]: ENTITLEMENT_KEYS.insightDevelopmentHub,
  [PATHS.sporcuSabahRaporu]: ENTITLEMENT_KEYS.insightWellnessArchive,
  [PATHS.auditLog]: ENTITLEMENT_KEYS.audit,
} as const satisfies Record<string, EntitlementKey>;

export const ROUTE_DYNAMIC_ENTITLEMENT_MAP = {
  [ROUTE_DYNAMIC_PATTERN_KEYS.athleteManagementProfile]: ENTITLEMENT_KEYS.core,
  [ROUTE_DYNAMIC_PATTERN_KEYS.privateLessonPackageDetail]: ENTITLEMENT_KEYS.privateLessons,
} as const satisfies Record<RouteDynamicPatternKey, EntitlementKey>;
