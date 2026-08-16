import { describe, expect, it } from "vitest";
import {
  evaluateQuickActionFeatureAccess,
  isQuickActionFeatureVisible,
} from "./quickActionFeatureVisibility";
import { QUICK_ACTION_IDS } from "@/lib/organization/features/surfaces/quickActionEntitlementMap";
import { buildOrganizationFeaturesFromConfigurable } from "@/lib/organization/features/helpers";
import { getPresetTemplateFlat } from "@/lib/organization/features/presets";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";

const ALL_ENABLED = createClubProfessionalFeatures();
const ALL_DISABLED = buildOrganizationFeaturesFromConfigurable(getPresetTemplateFlat("academy_lite"));

describe("quick action feature visibility", () => {
  it("shows a quick action when its entitlement is enabled", () => {
    expect(isQuickActionFeatureVisible(QUICK_ACTION_IDS.recordPayment, ALL_ENABLED)).toBe(true);
    expect(evaluateQuickActionFeatureAccess(QUICK_ACTION_IDS.recordPayment, ALL_ENABLED)).toBe("allow");
  });

  it("hides a quick action when its entitlement is disabled", () => {
    expect(isQuickActionFeatureVisible(QUICK_ACTION_IDS.recordPayment, ALL_DISABLED)).toBe(false);
    expect(evaluateQuickActionFeatureAccess(QUICK_ACTION_IDS.recordPayment, ALL_DISABLED)).toBe("deny");
  });

  it("hides the field test quick action when field tests are disabled", () => {
    expect(isQuickActionFeatureVisible(QUICK_ACTION_IDS.fieldTestEntry, ALL_DISABLED)).toBe(false);
  });

  it("keeps core quick actions visible even on the most restrictive preset", () => {
    expect(isQuickActionFeatureVisible(QUICK_ACTION_IDS.planGroupLesson, ALL_DISABLED)).toBe(true);
    expect(isQuickActionFeatureVisible(QUICK_ACTION_IDS.openAttendance, ALL_DISABLED)).toBe(true);
    expect(isQuickActionFeatureVisible(QUICK_ACTION_IDS.addAthlete, ALL_DISABLED)).toBe(true);
  });

  it("denies mapped quick actions while organization features are not yet loaded", () => {
    expect(evaluateQuickActionFeatureAccess(QUICK_ACTION_IDS.recordPayment, null)).toBe("deny");
    expect(isQuickActionFeatureVisible(QUICK_ACTION_IDS.recordPayment, null)).toBe(false);
  });

  it("skips evaluation for an undefined quick action id", () => {
    expect(evaluateQuickActionFeatureAccess(undefined, ALL_DISABLED)).toBe("skip");
  });
});
