import { describe, expect, it } from "vitest";
import {
  buildFieldTestValuesMapFromResults,
  buildPreviousFieldTestCellsMap,
  formatFieldTestDisplayString,
  pickLatestFieldTestResultsBeforeDate,
  formatFieldTestCellDisplayValue,
  fieldTestResultRowDisplay,
  resolveFieldTestCellValueFromRow,
} from "@/lib/fieldTests/hydrateFieldTestValuesFromResults";
import { formatFieldTestPreviousDateLabel } from "@/lib/fieldTests/fieldTestPreviousValueDisplay";

describe("resolveFieldTestCellValueFromRow", () => {
  it("prefers value_text for text metrics even when value is 0 placeholder", () => {
    expect(
      resolveFieldTestCellValueFromRow({
        value: 0,
        valueText: "postür notu",
        valueType: "text",
      })
    ).toBe("postür notu");
  });

  it("returns undefined for empty text metric", () => {
    expect(
      resolveFieldTestCellValueFromRow({
        value: 0,
        valueText: "",
        valueType: "text",
      })
    ).toBeUndefined();
  });

  it("uses numeric value for number metrics", () => {
    expect(
      resolveFieldTestCellValueFromRow({
        value: 10,
        valueText: null,
        valueType: "number",
      })
    ).toBe(10);
  });

  it("falls back to value_text when number metric has placeholder 0 with text", () => {
    expect(
      resolveFieldTestCellValueFromRow({
        value: 0,
        valueText: "legacy note",
        valueType: "number",
      })
    ).toBe("legacy note");
  });
});

describe("formatFieldTestCellDisplayValue", () => {
  it("treats lone 0 as empty for text metrics", () => {
    expect(formatFieldTestCellDisplayValue({ raw: 0, valueType: "text" })).toEqual({ kind: "empty" });
  });

  it("shows text for text metrics", () => {
    expect(formatFieldTestCellDisplayValue({ raw: "postür notu", valueType: "text" })).toEqual({
      kind: "text",
      value: "postür notu",
    });
  });

  it("formats numeric metrics with decimals", () => {
    expect(formatFieldTestCellDisplayValue({ raw: "12.5", valueType: "number" })).toEqual({
      kind: "number",
      integerPart: "12",
      decimalPart: "5",
    });
  });

  it("formats whole numbers without decimal part", () => {
    expect(formatFieldTestCellDisplayValue({ raw: 10, valueType: "number" })).toEqual({
      kind: "number",
      integerPart: "10",
    });
  });
});

describe("fieldTestResultRowDisplay", () => {
  it("shows value_text for text metrics", () => {
    expect(
      fieldTestResultRowDisplay({
        value: 0,
        value_text: "denemedeneme",
        value_type: "text",
      })
    ).toEqual({ kind: "text", value: "denemedeneme" });
  });

  it("falls back to value_text when numeric type but placeholder value", () => {
    expect(
      fieldTestResultRowDisplay({
        value: 0,
        value_text: "legacy note",
        value_type: "number",
      })
    ).toEqual({ kind: "text", value: "legacy note" });
  });
});

describe("buildFieldTestValuesMapFromResults", () => {
  it("hydrates text metrics without overwriting with 0", () => {
    const map = buildFieldTestValuesMapFromResults(
      [
        {
          profile_id: "p1",
          test_id: "postur",
          value: 0,
          value_text: "denemedeneme",
        },
        {
          profile_id: "p1",
          test_id: "omuz",
          value: 10,
          value_text: null,
        },
      ],
      { postur: "text", omuz: "number" }
    );

    expect(map["p1-postur"]).toBe("denemedeneme");
    expect(map["p1-omuz"]).toBe(10);
  });
});

describe("pickLatestFieldTestResultsBeforeDate", () => {
  it("keeps latest result per profile and metric before session date", () => {
    const rows = pickLatestFieldTestResultsBeforeDate(
      [
        { profile_id: "p1", test_id: "sprint", test_date: "2026-06-01", value: 4.8, value_text: null },
        { profile_id: "p1", test_id: "sprint", test_date: "2026-06-08", value: 4.6, value_text: null },
        { profile_id: "p1", test_id: "sprint", test_date: "2026-06-10", value: 4.5, value_text: null },
        { profile_id: "p1", test_id: "cmj", test_date: "2026-05-20", value: 42, value_text: null },
      ],
      "2026-06-10"
    );

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.test_id === "sprint")?.value).toBe(4.6);
    expect(rows.find((r) => r.test_id === "cmj")?.value).toBe(42);
  });
});

describe("buildPreviousFieldTestCellsMap", () => {
  it("builds display labels with units for numeric metrics", () => {
    const map = buildPreviousFieldTestCellsMap(
      [
        { profile_id: "p1", test_id: "sprint", test_date: "2026-06-08", value: 4.62, value_text: null },
        { profile_id: "p1", test_id: "note", test_date: "2026-06-08", value: 0, value_text: "iyi form" },
      ],
      "2026-06-10",
      { sprint: "number", note: "text" },
      { sprint: "sn", note: "" }
    );

    expect(map["p1-sprint"]).toEqual({ testDate: "2026-06-08", display: "4.62 sn" });
    expect(map["p1-note"]).toEqual({ testDate: "2026-06-08", display: "iyi form" });
  });
});

describe("formatFieldTestDisplayString", () => {
  it("appends unit for numeric values", () => {
    expect(formatFieldTestDisplayString({ raw: 10, valueType: "number", unit: "cm" })).toBe("10 cm");
  });
});

describe("formatFieldTestPreviousDateLabel", () => {
  it("formats ISO dates in Turkish locale", () => {
    expect(formatFieldTestPreviousDateLabel("2026-06-08")).toMatch(/8/);
    expect(formatFieldTestPreviousDateLabel("2026-06-08")).toMatch(/2026/);
  });
});
