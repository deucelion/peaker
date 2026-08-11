import type { AthleticResultCell } from "@/lib/actions/athleticFieldActions";
import {
  parseStoredFieldTestEditSeq,
  shouldSkipStaleFieldTestCellWrite,
} from "@/lib/fieldTests/fieldTestEditSeqMetadata";
import type { MetricValueKind } from "@/lib/fieldTests/metricValueType";

export type FieldTestCellWriteSource = "online" | "offline_replay";

export type StoredFieldTestCellRow = {
  value: number | null;
  value_text: string | null;
};

export type FieldTestCellWritePlan = {
  cell: AthleticResultCell;
  apply: boolean;
  reason?: "stale_edit_seq";
};

export function planFieldTestCellWrites(params: {
  cells: AthleticResultCell[];
  valueTypeByTestId: ReadonlyMap<string, MetricValueKind>;
  storedRowsByKey: ReadonlyMap<string, StoredFieldTestCellRow>;
  writeSource: FieldTestCellWriteSource;
}): FieldTestCellWritePlan[] {
  return params.cells.map((cell) => {
    const key = `${cell.profileId}-${cell.testId}`;
    const stored = params.storedRowsByKey.get(key) ?? null;
    const storedMeta = parseStoredFieldTestEditSeq(stored?.value_text);
    const incomingSeq = cell.editSeq ?? 0;

    if (
      shouldSkipStaleFieldTestCellWrite({
        incomingEditSeq: incomingSeq,
        storedEditSeq: storedMeta.editSeq,
      })
    ) {
      return { cell, apply: false, reason: "stale_edit_seq" };
    }

    return { cell, apply: true };
  });
}
