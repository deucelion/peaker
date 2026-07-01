import { describe, expect, it } from "vitest";
import { filterFieldTestAthletes } from "@/lib/fieldTests/filterFieldTestAthletes";
import type { ProfileBasic } from "@/types/domain";

const roster: ProfileBasic[] = [
  { id: "1", full_name: "YAVUZ ALPER DİNÇER", height: null, weight: null },
  { id: "2", full_name: "ZEYNEP PAŞA", height: null, weight: null },
];

describe("filterFieldTestAthletes", () => {
  it("returns all when query empty", () => {
    expect(filterFieldTestAthletes(roster, "")).toHaveLength(2);
  });

  it("filters case-insensitively with Turkish locale", () => {
    expect(filterFieldTestAthletes(roster, "zeynep")).toEqual([roster[1]]);
    expect(filterFieldTestAthletes(roster, "dinçer")).toEqual([roster[0]]);
  });
});
