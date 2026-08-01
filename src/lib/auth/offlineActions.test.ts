import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { buildOrganizationFeaturesFromConfigurable } from "@/lib/organization/features/helpers";
import { CONFIGURABLE_ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";
import {
  clearAllOfflineActions,
  enqueueOfflineAction,
  listAutoReplayCandidates,
  listOfflineActions,
} from "@/lib/offline/offlineActionQueue";
import { clearOfflineStorage } from "@/lib/offline/storage";
import { resetOfflineQueueForTests } from "@/lib/offline/queueStore";
import { replayOfflineActions } from "@/lib/offline/replayOfflineActions";

vi.mock("@/lib/offline/replayHandlers", () => ({
  replayOfflineActionByKind: vi.fn(),
}));

vi.mock("@/lib/monitoring/runtime", () => ({
  trackOfflineReplayBatch: vi.fn(),
  trackOfflineReplayFailure: vi.fn(),
}));

import { replayOfflineActionByKind } from "@/lib/offline/replayHandlers";

function createAllDisabledFeatures() {
  const configurable = Object.fromEntries(CONFIGURABLE_ENTITLEMENT_KEYS.map((key) => [key, false])) as Record<
    (typeof CONFIGURABLE_ENTITLEMENT_KEYS)[number],
    boolean
  >;
  return buildOrganizationFeaturesFromConfigurable(configurable);
}

describe("offline enqueue feature gate", () => {
  const scope = "org-1:user-1";

  beforeEach(() => {
    resetOfflineQueueForTests();
    clearOfflineStorage();
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
      removeItem(key: string) {
        delete this.store[key];
      },
    });
    clearAllOfflineActions();
  });

  it("does not enqueue when feature is denied", () => {
    const result = enqueueOfflineAction({
      kind: "wellness_draft",
      scopeKey: scope,
      payload: { form: { fatigue: 3 } },
      organizationFeatures: createAllDisabledFeatures(),
    });
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Bu modul organizasyonunuz icin aktif degil.");
    }
    expect(listOfflineActions(scope)).toHaveLength(0);
    expect(listAutoReplayCandidates(scope)).toHaveLength(0);
  });

  it("enqueues when feature is allowed", () => {
    const result = enqueueOfflineAction({
      kind: "attendance_draft",
      scopeKey: scope,
      payload: { trainingId: "t-1", profileId: "p-1", status: "attended" },
      organizationFeatures: createClubProfessionalFeatures(),
    });
    expect("error" in result).toBe(false);
    expect(listOfflineActions(scope)).toHaveLength(1);
  });

  it("does not create retry replay for denied kinds", async () => {
    enqueueOfflineAction({
      kind: "wellness_draft",
      scopeKey: scope,
      payload: { form: { fatigue: 3 } },
    });

    const result = await replayOfflineActions({
      scopeKey: scope,
      organizationFeatures: createAllDisabledFeatures(),
    });

    expect(replayOfflineActionByKind).not.toHaveBeenCalled();
    expect(result.processed).toBe(0);
  });
});
