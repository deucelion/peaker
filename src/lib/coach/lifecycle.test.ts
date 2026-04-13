import { describe, expect, it } from "vitest";
import {
  coachLifecycleLabel,
  isInactiveCoachProfile,
  messageIfCoachCannotOperate,
  profileRowIsActive,
} from "./lifecycle";

describe("coach lifecycle", () => {
  it("profileRowIsActive treats only explicit false as inactive", () => {
    expect(profileRowIsActive(true)).toBe(true);
    expect(profileRowIsActive(null)).toBe(true);
    expect(profileRowIsActive(undefined)).toBe(true);
    expect(profileRowIsActive(false)).toBe(false);
  });

  it("messageIfCoachCannotOperate only for inactive coach role", () => {
    expect(messageIfCoachCannotOperate("coach", false)).toBeTruthy();
    expect(messageIfCoachCannotOperate("coach", true)).toBeNull();
    expect(messageIfCoachCannotOperate("admin", false)).toBeNull();
  });

  it("isInactiveCoachProfile", () => {
    expect(isInactiveCoachProfile("coach", false)).toBe(true);
    expect(isInactiveCoachProfile("coach", true)).toBe(false);
    expect(isInactiveCoachProfile("sporcu", false)).toBe(false);
  });

  it("coachLifecycleLabel", () => {
    expect(coachLifecycleLabel(true)).toBe("active");
    expect(coachLifecycleLabel(false)).toBe("inactive");
  });
});
