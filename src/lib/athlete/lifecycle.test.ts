import { describe, expect, it } from "vitest";
import {
  ATHLETE_ACCOUNT_DISABLED_MESSAGE,
  isInactiveAthleteProfile,
  messageIfAthleteCannotOperate,
} from "./lifecycle";

describe("athlete lifecycle", () => {
  it("messageIfAthleteCannotOperate only for inactive sporcu role", () => {
    expect(messageIfAthleteCannotOperate("sporcu", false)).toBe(ATHLETE_ACCOUNT_DISABLED_MESSAGE);
    expect(messageIfAthleteCannotOperate("sporcu", true)).toBeNull();
    expect(messageIfAthleteCannotOperate("sporcu", null)).toBeNull();
    expect(messageIfAthleteCannotOperate("coach", false)).toBeNull();
  });

  it("isInactiveAthleteProfile", () => {
    expect(isInactiveAthleteProfile("sporcu", false)).toBe(true);
    expect(isInactiveAthleteProfile("sporcu", true)).toBe(false);
    expect(isInactiveAthleteProfile("coach", false)).toBe(false);
  });
});
