import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { buildOrganizationFeaturesFromConfigurable } from "@/lib/organization/features/helpers";
import { CONFIGURABLE_ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";
import { SNAPSHOT_BRANCH_IDS } from "@/lib/organization/features/surfaces/snapshotEntitlementMap";
import {
  evaluateSnapshotBranchFeatureAccess,
  isSnapshotBranchFeatureVisible,
} from "@/lib/auth/snapshotFeatureAccess";
import { optionalSnapshotBranchFields } from "@/lib/auth/snapshotFeatureAccess";

function createAllDisabledFeatures() {
  const configurable = Object.fromEntries(CONFIGURABLE_ENTITLEMENT_KEYS.map((key) => [key, false])) as Record<
    (typeof CONFIGURABLE_ENTITLEMENT_KEYS)[number],
    boolean
  >;
  return buildOrganizationFeaturesFromConfigurable(configurable);
}

function buildCoachDashboardBranches(features: ReturnType<typeof createClubProfessionalFeatures>) {
  const showNotifications = isSnapshotBranchFeatureVisible(
    SNAPSHOT_BRANCH_IDS.dashboardCoachNotifications,
    features
  );

  const coach: Record<string, unknown> = {
    permissions: {},
    todayLessons: [],
    upcomingLessons: [],
    pendingAttendanceLessons: [],
    activeTrainings: 0,
  };

  if (showNotifications) {
    coach.notificationPreview = [{ id: "n-1", message: "test", read: false, created_at: "2026-01-01" }];
  }

  return coach;
}

function buildAdminDashboardBranches(features: ReturnType<typeof createClubProfessionalFeatures>) {
  const showFinanceStats = isSnapshotBranchFeatureVisible(
    SNAPSHOT_BRANCH_IDS.dashboardAdminFinanceStats,
    features
  );
  const showRevenueMetrics = isSnapshotBranchFeatureVisible(
    SNAPSHOT_BRANCH_IDS.dashboardAdminRevenueMetrics,
    features
  );
  const showFieldTestOnboarding = isSnapshotBranchFeatureVisible(
    SNAPSHOT_BRANCH_IDS.dashboardAdminFieldTestOnboarding,
    features
  );

  const stats: Record<string, string | number> = {
    totalPlayers: 10,
    activeTrainings: 4,
    attendanceRate: "80",
  };
  if (showFinanceStats) {
    stats.monthlyRevenue = "1000";
  }

  const admin: Record<string, unknown> = {
    stats,
    attendanceTrend: "HEDEFE YAKIN",
    recentActivities: [],
    coaches: [],
    adminTodayLessons: [],
    adminPendingAttendance: [],
    activeCoachCountToday: 0,
    adminRecentPrograms: [],
    adminRecentAttendanceUpdates: [],
    ...optionalSnapshotBranchFields(SNAPSHOT_BRANCH_IDS.dashboardAdminRevenueMetrics, features, {
      revenueTrend: "%80 TAHSILAT",
    }),
    ...optionalSnapshotBranchFields(SNAPSHOT_BRANCH_IDS.dashboardAdminFinanceStats, features, {
      teamStats: [{ name: "A", completionRate: 100, paymentStatus: "TAMAM", warning: false }],
    }),
  };

  if (showFieldTestOnboarding) {
    admin.onboarding = {
      totalAthletes: 10,
      totalTeams: 2,
      totalLessons: 4,
      totalFieldTestMetrics: 1,
      ...(showFinanceStats ? { totalPayments: 5 } : {}),
    };
  }

  return admin;
}

describe("snapshot branch response assembly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("omits denied coach notification branch from response", () => {
    const coach = buildCoachDashboardBranches(createAllDisabledFeatures());
    expect(coach).not.toHaveProperty("notificationPreview");
    expect(coach.todayLessons).toEqual([]);
  });

  it("includes allowed coach notification branch", () => {
    const coach = buildCoachDashboardBranches(createClubProfessionalFeatures());
    expect(coach.notificationPreview).toHaveLength(1);
  });

  it("omits denied admin finance branches from response", () => {
    const admin = buildAdminDashboardBranches(createAllDisabledFeatures());
    expect(admin.stats).toEqual({
      totalPlayers: 10,
      activeTrainings: 4,
      attendanceRate: "80",
    });
    expect(admin.stats).not.toHaveProperty("monthlyRevenue");
    expect(admin).not.toHaveProperty("revenueTrend");
    expect(admin).not.toHaveProperty("teamStats");
    expect(admin).not.toHaveProperty("onboarding");
  });

  it("preserves response shape for allowed Club Professional snapshot", () => {
    const admin = buildAdminDashboardBranches(createClubProfessionalFeatures());
    expect(admin.stats).toMatchObject({
      totalPlayers: 10,
      activeTrainings: 4,
      attendanceRate: "80",
      monthlyRevenue: "1000",
    });
    expect(admin.revenueTrend).toBe("%80 TAHSILAT");
    expect(admin.teamStats).toHaveLength(1);
    expect(admin.onboarding).toMatchObject({
      totalAthletes: 10,
      totalFieldTestMetrics: 1,
      totalPayments: 5,
    });
  });

  it("regresses core admin stats parity when finance is disabled", () => {
    const features = createAllDisabledFeatures();
    expect(evaluateSnapshotBranchFeatureAccess(SNAPSHOT_BRANCH_IDS.dashboardAdminFinanceStats, features)).toBe(
      "deny"
    );
    const admin = buildAdminDashboardBranches(features);
    expect(admin.stats).toHaveProperty("totalPlayers");
    expect(admin.stats).toHaveProperty("attendanceRate");
  });
});
