import { describe, expect, it } from "vitest";
import {
  encodeNumericCellEditSeqMetadata,
  encodeTextCellWithEditSeq,
  fieldTestUserFacingText,
  FIELD_TEST_EDIT_SEQ_PREFIX,
  parseStoredFieldTestEditSeq,
} from "@/lib/fieldTests/fieldTestEditSeqMetadata";
import {
  buildFieldTestValuesMapFromResults,
  buildPreviousFieldTestCellsMap,
  fieldTestResultRowDisplay,
  resolveFieldTestCellValueFromRow,
} from "@/lib/fieldTests/hydrateFieldTestValuesFromResults";

const LEAK = FIELD_TEST_EDIT_SEQ_PREFIX;

describe("fieldTestUserFacingText — canonical sanitizer", () => {
  it("strips edit-seq metadata from a text measurement", () => {
    expect(fieldTestUserFacingText(encodeTextCellWithEditSeq("Postür iyi", 105))).toBe("Postür iyi");
  });

  it("returns empty string for a numeric cell that only carries metadata", () => {
    expect(fieldTestUserFacingText(encodeNumericCellEditSeqMetadata(105))).toBe("");
  });

  it("leaves legacy rows without metadata unchanged", () => {
    expect(fieldTestUserFacingText("denemedeneme")).toBe("denemedeneme");
  });

  it("handles null, undefined and empty values", () => {
    expect(fieldTestUserFacingText(null)).toBe("");
    expect(fieldTestUserFacingText(undefined)).toBe("");
    expect(fieldTestUserFacingText("")).toBe("");
  });

  it("handles malformed metadata safely", () => {
    expect(fieldTestUserFacingText(`iyi\n${LEAK}abc`)).toBe("iyi");
    expect(fieldTestUserFacingText(`iyi\n${LEAK}`)).toBe("iyi");
    expect(parseStoredFieldTestEditSeq(`iyi\n${LEAK}abc`).editSeq).toBe(0);
  });

  it("preserves multi-line user text while stripping only the metadata suffix", () => {
    const stored = encodeTextCellWithEditSeq("satır1\nsatır2", 7);
    expect(fieldTestUserFacingText(stored)).toBe("satır1\nsatır2");
    expect(parseStoredFieldTestEditSeq(stored).editSeq).toBe(7);
  });
});

describe("no consumer surface exposes edit-seq metadata", () => {
  const metricTypes = { postur: "text", sprint: "number" } as const;

  it("form hydration returns clean values", () => {
    const map = buildFieldTestValuesMapFromResults(
      [
        { profile_id: "p1", test_id: "postur", value: 0, value_text: encodeTextCellWithEditSeq("iyi", 105) },
        { profile_id: "p1", test_id: "sprint", value: 1.85, value_text: encodeNumericCellEditSeqMetadata(12) },
      ],
      metricTypes
    );
    expect(map["p1-postur"]).toBe("iyi");
    expect(map["p1-sprint"]).toBe(1.85);
    expect(JSON.stringify(map)).not.toContain(LEAK);
  });

  it("previous-measurement cells are clean", () => {
    const map = buildPreviousFieldTestCellsMap(
      [
        {
          profile_id: "p1",
          test_id: "postur",
          test_date: "2026-06-08",
          value: 0,
          value_text: encodeTextCellWithEditSeq("orta", 3),
        },
      ],
      "2026-08-11",
      metricTypes
    );
    expect(map["p1-postur"]?.display).toBe("orta");
    expect(JSON.stringify(map)).not.toContain(LEAK);
  });

  it("athlete detail row display is clean", () => {
    const display = fieldTestResultRowDisplay({
      value: 0,
      value_text: encodeTextCellWithEditSeq("denemedeneme", 105),
      value_type: "text",
    });
    expect(display).toEqual({ kind: "text", value: "denemedeneme" });
  });

  it("numeric cell with metadata-only value_text stays numeric", () => {
    expect(
      resolveFieldTestCellValueFromRow({
        value: 4.2,
        valueText: encodeNumericCellEditSeqMetadata(9),
        valueType: "number",
      })
    ).toBe(4.2);
  });

  /**
   * Regression — müşteri PDF raporlarında her yazılı ölçümün altında
   * "__peaker_edit_seq:105" görünüyordu.
   */
  it("pdf text-metric cell never contains metadata", () => {
    const row = { value_text: encodeTextCellWithEditSeq("iyi", 105), value: 0 };
    const pdfValue = fieldTestUserFacingText(row.value_text) || "—";
    expect(pdfValue).toBe("iyi");
    expect(pdfValue).not.toContain(LEAK);
  });

  it("csv text column never contains metadata", () => {
    const csvCell = fieldTestUserFacingText(encodeTextCellWithEditSeq("saha ıslak", 42));
    expect(csvCell).toBe("saha ıslak");
    expect(csvCell).not.toContain(LEAK);
  });
});
