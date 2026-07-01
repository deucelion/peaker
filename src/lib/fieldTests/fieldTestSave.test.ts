import { describe, expect, it } from "vitest";
import {
  buildAthleticResultUpsertRow,
  FIELD_TEST_TEXT_VALUE_PLACEHOLDER,
} from "@/lib/fieldTests/athleticResultsWriteShape";
import { buildFieldTestCells, metricValueKindFromRow } from "@/lib/fieldTests/buildFieldTestSavePayload";
import { mapFieldTestWriteError } from "@/lib/fieldTests/fieldTestSaveErrors";

describe("buildFieldTestCells", () => {
  it("builds numeric and text cells", () => {
    const { cells, error } = buildFieldTestCells({
      selectedProfileIds: ["p1"],
      metrics: [
        { id: "t1", valueType: "number" },
        { id: "t2", valueType: "text" },
      ],
      testValues: {
        "p1-t1": "12.5",
        "p1-t2": "  not  ",
      },
    });
    expect(error).toBeUndefined();
    expect(cells).toHaveLength(2);
    expect(cells[0]).toMatchObject({ valueNumber: 12.5, valueText: null });
    expect(cells[1]).toMatchObject({ valueNumber: null, valueText: "not" });
  });

  it("rejects NaN numeric", () => {
    const { error } = buildFieldTestCells({
      selectedProfileIds: ["p1"],
      metrics: [{ id: "t1", valueType: "number" }],
      testValues: { "p1-t1": "abc" },
    });
    expect(error).toBe("Geçersiz sayısal değer.");
  });

  it("normalizes yazılı not value_type", () => {
    expect(metricValueKindFromRow({ value_type: "yazılı" })).toBe("text");
  });

  it("only includes dirty cell keys when onlyCellKeys is set", () => {
    const profileId = "550e8400-e29b-41d4-a716-446655440000";
    const t1 = "660e8400-e29b-41d4-a716-446655440001";
    const t2 = "770e8400-e29b-41d4-a716-446655440002";
    const { cells } = buildFieldTestCells({
      selectedProfileIds: [profileId],
      metrics: [
        { id: t1, valueType: "number" },
        { id: t2, valueType: "text" },
      ],
      testValues: {
        [`${profileId}-${t1}`]: "5",
        [`${profileId}-${t2}`]: "not",
      },
      onlyCellKeys: new Set([`${profileId}-${t1}`]),
    });
    expect(cells).toHaveLength(1);
    expect(cells[0]?.testId).toBe(t1);
  });
});

describe("buildAthleticResultUpsertRow", () => {
  it("uses placeholder value for text when value_text exists", () => {
    const row = buildAthleticResultUpsertRow({
      profileId: "p",
      testId: "t",
      testDate: "2026-05-20",
      organizationId: "org",
      valueType: "text",
      valueNumber: null,
      valueText: "note",
      shape: { hasValueText: true, hasOrganizationId: true },
    });
    expect(row.value).toBe(FIELD_TEST_TEXT_VALUE_PLACEHOLDER);
    expect(row.value_text).toBe("note");
  });

  it("omits value_text when column missing", () => {
    const row = buildAthleticResultUpsertRow({
      profileId: "p",
      testId: "t",
      testDate: "2026-05-20",
      organizationId: "org",
      valueType: "number",
      valueNumber: 3,
      valueText: null,
      shape: { hasValueText: false, hasOrganizationId: true },
    });
    expect(row.value).toBe(3);
    expect("value_text" in row).toBe(false);
  });
});

describe("mapFieldTestWriteError", () => {
  it("maps missing value_text column", () => {
    expect(
      mapFieldTestWriteError("PGRST204", "Could not find the value_text column", "x")
    ).toContain("value_text");
  });
});
