/** Unit coverage for the attendance classification and daily-update guardrails. */
import { describe, expect, it } from "vitest";
import { classifyOfficePunchIn, isPermittedWorkUpdateDate, sumTaskMinutes } from "../lib/operation-rules";

describe("DevSync attendance and work-update rules", () => {
  it("allows on-time punches through the configured 9:15 AM IST grace boundary", () => {
    expect(classifyOfficePunchIn(9 * 60)).toBe("on_time");
    expect(classifyOfficePunchIn(9 * 60 + 15)).toBe("on_time");
    expect(classifyOfficePunchIn(9 * 60 + 16)).toBe("late");
  });

  it("permits daily updates only for today or yesterday", () => {
    expect(isPermittedWorkUpdateDate("2026-08-26", "2026-08-26", "2026-08-25")).toBe(true);
    expect(isPermittedWorkUpdateDate("2026-08-25", "2026-08-26", "2026-08-25")).toBe(true);
    expect(isPermittedWorkUpdateDate("2026-08-24", "2026-08-26", "2026-08-25")).toBe(false);
  });

  it("adds task durations without hiding zero-minute work items", () => {
    expect(sumTaskMinutes([{ minutes: 90 }, { minutes: 0 }, { minutes: 45 }])).toBe(135);
  });
});
