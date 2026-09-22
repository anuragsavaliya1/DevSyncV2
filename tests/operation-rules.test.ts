/** Unit coverage for the attendance classification and daily-update guardrails. */
import { describe, expect, it } from "vitest";
import {
  assertWorkUpdateSubmittedBeforePunchOut,
  classifyOfficePunchIn,
  classifyOfficePunchOut,
  isPermittedWorkUpdateDate,
  mergeWorkUpdateTasks,
  requiresWorkUpdateBeforePunchOut,
  sumTaskMinutes,
  WORK_UPDATE_REQUIRED_BEFORE_PUNCH_OUT_MESSAGE,
} from "../lib/operation-rules";

describe("DevSync attendance and work-update rules", () => {
  it("allows on-time punches through the configured 9:15 AM IST grace boundary", () => {
    expect(classifyOfficePunchIn(9 * 60)).toBe("on_time");
    expect(classifyOfficePunchIn(9 * 60 + 15)).toBe("on_time");
    expect(classifyOfficePunchIn(9 * 60 + 16)).toBe("late");
  });

  it("flags punch-out before expected end for reports", () => {
    expect(classifyOfficePunchOut(18 * 60 + 29)).toBe("early");
    expect(classifyOfficePunchOut(18 * 60 + 30)).toBe("on_time");
    // 09:05 in → 18:35 expected
    expect(classifyOfficePunchOut(18 * 60 + 34, 9 * 60 + 5)).toBe("early");
    expect(classifyOfficePunchOut(18 * 60 + 35, 9 * 60 + 5)).toBe("on_time");
  });

  it("permits daily updates only for today or yesterday", () => {
    expect(
      isPermittedWorkUpdateDate("2026-08-26", "2026-08-26", "2026-08-25")
    ).toBe(true);
    expect(
      isPermittedWorkUpdateDate("2026-08-25", "2026-08-26", "2026-08-25")
    ).toBe(true);
    expect(
      isPermittedWorkUpdateDate("2026-08-24", "2026-08-26", "2026-08-25")
    ).toBe(false);
  });

  it("adds task durations without hiding zero-minute work items", () => {
    expect(
      sumTaskMinutes([{ minutes: 90 }, { minutes: 0 }, { minutes: 45 }])
    ).toBe(135);
  });

  it("requires developers to submit today's work update before punch-out", () => {
    expect(requiresWorkUpdateBeforePunchOut("developer")).toBe(true);
    expect(requiresWorkUpdateBeforePunchOut("manager")).toBe(false);
    expect(requiresWorkUpdateBeforePunchOut("admin")).toBe(false);

    expect(() =>
      assertWorkUpdateSubmittedBeforePunchOut({
        role: "developer",
        hasTodaysWorkUpdate: false,
      }),
    ).toThrow(WORK_UPDATE_REQUIRED_BEFORE_PUNCH_OUT_MESSAGE);

    expect(() =>
      assertWorkUpdateSubmittedBeforePunchOut({
        role: "developer",
        hasTodaysWorkUpdate: true,
      }),
    ).not.toThrow();

    expect(() =>
      assertWorkUpdateSubmittedBeforePunchOut({
        role: "manager",
        hasTodaysWorkUpdate: false,
      }),
    ).not.toThrow();
  });

  it("appends new work-update tasks instead of replacing prior ones", () => {
    const existing = [
      { id: "a", description: "First", minutes: 30 },
      { id: "b", description: "Second", minutes: 45 },
    ];
    const draft = [{ id: "c", description: "Third", minutes: 20 }];
    expect(mergeWorkUpdateTasks({ existingTasks: existing, draftTasks: draft })).toEqual([
      ...existing,
      ...draft,
    ]);
  });

  it("replaces tasks when draft is an edit of the existing update", () => {
    const existing = [
      { id: "a", description: "First", minutes: 30 },
      { id: "b", description: "Second", minutes: 45 },
    ];
    const draft = [
      { id: "a", description: "First edited", minutes: 40 },
      { id: "c", description: "Added while editing", minutes: 15 },
    ];
    expect(mergeWorkUpdateTasks({ existingTasks: existing, draftTasks: draft })).toEqual(
      draft,
    );
  });
});
