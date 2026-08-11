import { describe, expect, it } from "vitest";
import type { AthleticResultCell } from "@/lib/actions/athleticFieldActions";
import { planFieldTestCellWrites } from "@/lib/fieldTests/fieldTestCellWriteGuard";
import { encodeNumericCellEditSeqMetadata } from "@/lib/fieldTests/fieldTestEditSeqMetadata";

const PROFILE = "11111111-1111-4111-8111-111111111111";
const METRIC_A = "22222222-2222-4222-8222-222222222222";
const METRIC_B = "33333333-3333-4333-8333-333333333333";

function cell(profileId: string, testId: string, value: number, editSeq: number): AthleticResultCell {
  return { profileId, testId, valueNumber: value, valueText: null, editSeq };
}

function storedRow(editSeq: number, value: number | null = editSeq * 10) {
  return {
    value,
    value_text: encodeNumericCellEditSeqMetadata(editSeq),
  };
}

function replayPlan(params: {
  cells: AthleticResultCell[];
  stored: Map<string, { value: number | null; value_text: string | null }>;
  writeSource?: "online" | "offline_replay";
}) {
  return planFieldTestCellWrites({
    cells: params.cells,
    valueTypeByTestId: new Map([
      [METRIC_A, "number"],
      [METRIC_B, "number"],
    ]),
    storedRowsByKey: params.stored,
    writeSource: params.writeSource ?? "offline_replay",
  });
}

function applyAccepted(
  stored: Map<string, { value: number | null; value_text: string | null }>,
  plans: ReturnType<typeof replayPlan>
) {
  for (const plan of plans) {
    if (!plan.apply) continue;
    const key = `${plan.cell.profileId}-${plan.cell.testId}`;
    stored.set(key, storedRow(plan.cell.editSeq ?? 0, plan.cell.valueNumber));
  }
}

describe("field test offline queue integrity (server-side stale guard simulation)", () => {
  it("Test A: replay #2 then #1 keeps DB at 30", () => {
    const stored = new Map<string, { value: number | null; value_text: string | null }>();
    const key = `${PROFILE}-${METRIC_A}`;

    applyAccepted(
      stored,
      replayPlan({ cells: [cell(PROFILE, METRIC_A, 20, 1)], stored })
    );
    applyAccepted(
      stored,
      replayPlan({ cells: [cell(PROFILE, METRIC_A, 30, 2)], stored })
    );

    expect(stored.get(key)?.value).toBe(30);

    const staleFirst = replayPlan({ cells: [cell(PROFILE, METRIC_A, 20, 1)], stored });
    expect(staleFirst[0]?.apply).toBe(false);
    expect(stored.get(key)?.value).toBe(30);
  });

  it("Test B: online 40 then replay old 20 keeps DB at 40", () => {
    const stored = new Map<string, { value: number | null; value_text: string | null }>();
    const key = `${PROFILE}-${METRIC_A}`;

    applyAccepted(
      stored,
      replayPlan({
        cells: [cell(PROFILE, METRIC_A, 40, 5)],
        stored,
        writeSource: "online",
      })
    );
    expect(stored.get(key)?.value).toBe(40);

    const staleReplay = replayPlan({ cells: [cell(PROFILE, METRIC_A, 20, 1)], stored });
    expect(staleReplay[0]?.apply).toBe(false);
    expect(stored.get(key)?.value).toBe(40);
  });

  it("Test C: FIFO replay 20 then 30 ends at 30", () => {
    const stored = new Map<string, { value: number | null; value_text: string | null }>();
    const key = `${PROFILE}-${METRIC_A}`;

    applyAccepted(stored, replayPlan({ cells: [cell(PROFILE, METRIC_A, 20, 1)], stored }));
    applyAccepted(stored, replayPlan({ cells: [cell(PROFILE, METRIC_A, 30, 2)], stored }));

    expect(stored.get(key)?.value).toBe(30);
  });

  it("Test D: stale payload is rejected as no-op", () => {
    const stored = new Map<string, { value: number | null; value_text: string | null }>();
    stored.set(`${PROFILE}-${METRIC_A}`, storedRow(4, 40));

    const plan = replayPlan({ cells: [cell(PROFILE, METRIC_A, 20, 2)], stored });
    expect(plan[0]?.apply).toBe(false);
    expect(plan[0]?.reason).toBe("stale_edit_seq");
  });

  it("Test E: stale protection on metric A does not block metric B", () => {
    const stored = new Map<string, { value: number | null; value_text: string | null }>();
    stored.set(`${PROFILE}-${METRIC_A}`, storedRow(3, 30));

    const plans = replayPlan({
      cells: [
        cell(PROFILE, METRIC_A, 20, 1),
        cell(PROFILE, METRIC_B, 50, 1),
      ],
      stored,
    });

    expect(plans[0]?.apply).toBe(false);
    expect(plans[1]?.apply).toBe(true);
  });
});
