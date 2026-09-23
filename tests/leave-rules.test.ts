/** Unit coverage for leave application and review guardrails. */
import { describe, expect, it } from "vitest";
import {
  assertLeaveCanBeRejected,
  assertLeaveDateRangeValid,
  assertLeaveRequestPending,
  buildLeaveStatusSummary,
  canManageLeaveRequests,
  countLeaveWorkingDays,
  isHalfDayPortion,
  leaveDayPortionLabel,
  leaveCoverageSummary,
  planFullDayLeaveCancelForPunchDate,
  rangesOverlap,
  selectPreviousLeaveRequests,
  validateLeaveManagerRemark,
  validateLeaveReason,
  validateRejectionReason,
} from "../lib/leave-rules";

describe("leave authorization", () => {
  it("allows Manager and Admin to review leave", () => {
    expect(canManageLeaveRequests("manager")).toBe(true);
    expect(canManageLeaveRequests("admin")).toBe(true);
  });

  it("blocks Developer from approving or rejecting leave", () => {
    expect(canManageLeaveRequests("developer")).toBe(false);
  });
});

describe("leave status summary cards", () => {
  it("aggregates pending, approved, and rejected counts", () => {
    expect(
      buildLeaveStatusSummary([
        { status: "pending", count: 4 },
        { status: "approved", count: 7 },
        { status: "rejected", count: 2 },
      ]),
    ).toEqual({ pending: 4, approved: 7, rejected: 2, total: 13 });
  });

  it("ignores unknown statuses and clamps negative counts", () => {
    expect(
      buildLeaveStatusSummary([
        { status: "pending", count: 1 },
        { status: "cancelled", count: 9 },
        { status: "approved", count: -3 },
      ]),
    ).toEqual({ pending: 1, approved: 0, rejected: 0, total: 1 });
  });
});

describe("leave date validation", () => {
  it("requires from date before or equal to to date", () => {
    expect(() =>
      assertLeaveDateRangeValid({
        startDate: "2026-09-20",
        endDate: "2026-09-18",
        today: "2026-09-14",
      }),
    ).toThrow("From date cannot be after to date.");
  });

  it("counts working days excluding Sundays", () => {
    // Fri–Mon: Fri, Sat, Mon (Sunday excluded) = 3
    expect(countLeaveWorkingDays("2026-09-11", "2026-09-14")).toBe(3);
  });

  it("rejects Sunday-only ranges with a Sunday-specific message", () => {
    expect(() =>
      assertLeaveDateRangeValid({
        startDate: "2026-09-13",
        endDate: "2026-09-13",
        today: "2026-09-14",
        allowPastStart: true,
      }),
    ).toThrow("Cannot apply leave on Sunday (13 Sept 2026).");
  });

  it("rejects company holidays with the holiday name", () => {
    const holidayByDate = new Map([
      ["2026-10-02", { kind: "holiday" as const, name: "Gandhi Jayanti" }],
    ]);
    expect(() =>
      assertLeaveDateRangeValid({
        startDate: "2026-10-02",
        endDate: "2026-10-02",
        today: "2026-09-17",
        holidayByDate,
      }),
    ).toThrow("Cannot apply leave on holiday Gandhi Jayanti (02 Oct 2026).");
  });

  it("rejects company week offs with the week-off name", () => {
    const holidayByDate = new Map([
      ["2026-09-18", { kind: "weekoff" as const, name: "Team offsite" }],
    ]);
    expect(() =>
      assertLeaveDateRangeValid({
        startDate: "2026-09-18",
        endDate: "2026-09-18",
        today: "2026-09-17",
        holidayByDate,
      }),
    ).toThrow("Cannot apply leave on week off Team offsite (18 Sept 2026).");
  });

  it("allows multi-day leave spanning Sunday and counts only working days", () => {
    // Fri–Mon: Fri, Sat, Mon (Sunday excluded) = 3 working days
    expect(
      assertLeaveDateRangeValid({
        startDate: "2026-09-11",
        endDate: "2026-09-14",
        today: "2026-09-10",
      }),
    ).toBe(3);
  });

  it("allows multi-day leave spanning a company holiday and counts only working days", () => {
    const holidayByDate = new Map([
      ["2026-10-02", { kind: "holiday" as const, name: "Gandhi Jayanti" }],
    ]);
    // Thu 1 Oct, Fri 2 Oct (holiday), Sat 3 Oct → 2 working days
    expect(
      assertLeaveDateRangeValid({
        startDate: "2026-10-01",
        endDate: "2026-10-03",
        today: "2026-09-28",
        holidayByDate,
      }),
    ).toBe(2);
  });

  it("supports half-day leave on a single working day", () => {
    expect(
      assertLeaveDateRangeValid({
        startDate: "2026-09-15",
        endDate: "2026-09-15",
        today: "2026-09-14",
        dayPortion: "half",
      }),
    ).toBe(0.5);
  });

  it("rejects half-day spanning multiple dates", () => {
    expect(() =>
      assertLeaveDateRangeValid({
        startDate: "2026-09-15",
        endDate: "2026-09-16",
        today: "2026-09-14",
        dayPortion: "half",
      }),
    ).toThrow("Half-day leave must be for a single date.");
  });

  it("blocks employees from starting leave in the past", () => {
    expect(() =>
      assertLeaveDateRangeValid({
        startDate: "2026-09-10",
        endDate: "2026-09-10",
        today: "2026-09-17",
        allowPastStart: false,
      }),
    ).toThrow("Leave cannot start on a past date.");
  });

  it("allows admin/manager backdated leave within the lookback window", () => {
    expect(
      assertLeaveDateRangeValid({
        startDate: "2026-09-10",
        endDate: "2026-09-10",
        today: "2026-09-17",
        allowPastStart: true,
      }),
    ).toBe(1);
  });

  it("rejects leave ranges longer than 30 calendar days", () => {
    expect(() =>
      assertLeaveDateRangeValid({
        startDate: "2026-09-01",
        endDate: "2026-10-02",
        today: "2026-08-28",
        allowPastStart: true,
      }),
    ).toThrow("Leave cannot be applied for more than 30 days.");
  });
});

describe("leave overlap", () => {
  it("detects overlapping ranges", () => {
    expect(rangesOverlap("2026-09-15", "2026-09-17", "2026-09-16", "2026-09-18")).toBe(
      true,
    );
    expect(rangesOverlap("2026-09-15", "2026-09-17", "2026-09-18", "2026-09-19")).toBe(
      false,
    );
  });
});

describe("leave reasons", () => {
  it("requires leave and rejection reasons", () => {
    expect(() => validateLeaveReason("  ")).toThrow("A reason is required.");
    expect(() => validateRejectionReason("")).toThrow(
      "A rejection reason is required.",
    );
    expect(validateRejectionReason(" Project deadline ")).toBe(
      "Project deadline",
    );
  });

  it("allows optional manager remark up to 2000 characters", () => {
    expect(validateLeaveManagerRemark(undefined)).toBe("");
    expect(validateLeaveManagerRemark("  Covered  ")).toBe("Covered");
    expect(() => validateLeaveManagerRemark("x".repeat(2001))).toThrow(
      /Remark must be at most 2000/,
    );
  });

  it("blocks re-review of non-pending requests for approve path", () => {
    expect(() => assertLeaveRequestPending("approved")).toThrow(
      "This leave request has already been reviewed.",
    );
    expect(() => assertLeaveRequestPending("rejected")).toThrow(
      "This leave request has already been reviewed.",
    );
    expect(() => assertLeaveRequestPending("pending")).not.toThrow();
  });

  it("allows rejecting pending or approved leave", () => {
    expect(() => assertLeaveCanBeRejected("pending")).not.toThrow();
    expect(() => assertLeaveCanBeRejected("approved")).not.toThrow();
    expect(() => assertLeaveCanBeRejected("rejected")).toThrow(
      "Only pending or approved leave can be rejected.",
    );
  });
});

describe("half-day sessions", () => {
  it("labels 1st and 2nd half distinctly", () => {
    expect(leaveDayPortionLabel("first_half")).toBe("1st Half");
    expect(leaveDayPortionLabel("second_half")).toBe("2nd Half");
    expect(leaveDayPortionLabel("half")).toBe("Half Day");
    expect(leaveDayPortionLabel("full")).toBe("Full Day");
  });

  it("builds compact leave coverage summaries for UI chips", () => {
    expect(
      leaveCoverageSummary({ dayPortion: "full", leaveType: "casual" }),
    ).toBe("Full Day · Casual");
    expect(
      leaveCoverageSummary({ dayPortion: "first_half", leaveType: "sick" }),
    ).toBe("1st Half · Sick");
    expect(
      leaveCoverageSummary({ dayPortion: "hours_2", leaveType: "other" }),
    ).toBe("2 Hours · Other");
  });

  it("treats first/second half as half-day leave for validation", () => {
    expect(isHalfDayPortion("first_half")).toBe(true);
    expect(isHalfDayPortion("second_half")).toBe(true);
    expect(
      assertLeaveDateRangeValid({
        startDate: "2026-09-15",
        endDate: "2026-09-15",
        today: "2026-09-14",
        dayPortion: "second_half",
        allowPastStart: true,
      }),
    ).toBe(0.5);
    expect(() =>
      assertLeaveDateRangeValid({
        startDate: "2026-09-15",
        endDate: "2026-09-16",
        today: "2026-09-14",
        dayPortion: "first_half",
        allowPastStart: true,
      }),
    ).toThrow("Half-day leave must be for a single date.");
  });

  it("accepts hourly other-duration leave as a single-day fraction", () => {
    expect(leaveDayPortionLabel("hours_1")).toBe("1 Hour");
    expect(leaveDayPortionLabel("hours_2")).toBe("2 Hours");
    expect(leaveDayPortionLabel("hours_3")).toBe("3 Hours");
    expect(
      assertLeaveDateRangeValid({
        startDate: "2026-09-15",
        endDate: "2026-09-15",
        today: "2026-09-14",
        dayPortion: "hours_2",
        allowPastStart: true,
      }),
    ).toBe(0.25);
    expect(() =>
      assertLeaveDateRangeValid({
        startDate: "2026-09-15",
        endDate: "2026-09-16",
        today: "2026-09-14",
        dayPortion: "hours_1",
        allowPastStart: true,
      }),
    ).toThrow("Hourly leave must be for a single date.");
  });
});

describe("selectPreviousLeaveRequests", () => {
  it("returns the latest 3 leaves for one employee excluding the current request", () => {
    const rows = [
      {
        id: "current",
        userId: "u1",
        startDate: "2026-09-24",
        endDate: "2026-09-24",
        appliedAt: "2026-09-20T10:00:00.000Z",
      },
      {
        id: "a",
        userId: "u1",
        startDate: "2026-08-01",
        endDate: "2026-08-01",
        appliedAt: "2026-07-28T10:00:00.000Z",
      },
      {
        id: "b",
        userId: "u1",
        startDate: "2026-09-01",
        endDate: "2026-09-02",
        appliedAt: "2026-08-28T10:00:00.000Z",
      },
      {
        id: "c",
        userId: "u1",
        startDate: "2026-07-10",
        endDate: "2026-07-10",
        appliedAt: "2026-07-08T10:00:00.000Z",
      },
      {
        id: "d",
        userId: "u1",
        startDate: "2026-06-01",
        endDate: "2026-06-01",
        appliedAt: "2026-05-28T10:00:00.000Z",
      },
      {
        id: "other",
        userId: "u2",
        startDate: "2026-09-20",
        endDate: "2026-09-20",
        appliedAt: "2026-09-18T10:00:00.000Z",
      },
    ];

    expect(
      selectPreviousLeaveRequests(rows, {
        userId: "u1",
        excludeId: "current",
        limit: 3,
      }).map((row) => row.id),
    ).toEqual(["b", "a", "c"]);
  });
});

describe("full-day leave cancel on punch", () => {
  it("rejects single-day full leave when punched", () => {
    expect(
      planFullDayLeaveCancelForPunchDate({
        startDate: "2026-09-15",
        endDate: "2026-09-15",
        dayPortion: "full",
        status: "approved",
        punchDate: "2026-09-15",
      }),
    ).toEqual({ action: "reject" });
  });

  it("does not cancel half-day leave on punch", () => {
    expect(
      planFullDayLeaveCancelForPunchDate({
        startDate: "2026-09-15",
        endDate: "2026-09-15",
        dayPortion: "first_half",
        status: "approved",
        punchDate: "2026-09-15",
      }),
    ).toBeNull();
  });

  it("rejects multi-day full leave when any covered day is punched", () => {
    expect(
      planFullDayLeaveCancelForPunchDate({
        startDate: "2026-09-14",
        endDate: "2026-09-16",
        dayPortion: "full",
        status: "approved",
        punchDate: "2026-09-15",
      }),
    ).toEqual({ action: "reject" });
  });
});
