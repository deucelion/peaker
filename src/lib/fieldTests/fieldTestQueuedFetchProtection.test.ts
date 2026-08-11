import { describe, expect, it } from "vitest";
import { shouldPreserveLocalFieldTestValuesOnFetch } from "@/lib/fieldTests/fieldTestAutosave";

describe("FieldTestSessionEntry fetch hydration guard", () => {
  it("does not overwrite local unsynced values when queued", () => {
    const dbValue = 10;
    const localValue = 30;
    const saveFeedback = "queued" as const;

    let displayed = localValue;
    if (!shouldPreserveLocalFieldTestValuesOnFetch(saveFeedback)) {
      displayed = dbValue;
    }

    expect(displayed).toBe(30);
  });
});
