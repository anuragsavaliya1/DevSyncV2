/** Unit coverage for punch-out correction and manual punch-out guardrails. */
import { describe, expect, it } from "vitest";
import {
  assertAttendanceOpenForCorrection,
  assertAttendanceStillOpenForApproval,
  assertRequestPending,
  assertRequestedPunchInIsValid,
  assertRequestedPunchOutIsValid,
  canManagePunchOutCorrections,
  isPunchInCorrectionDateAllowed,
  isPunchOutCorrectionDateAllowed,
  normalizeCorrectionType,
  validateCorrectionReason,
  validateReviewNote,
} from "../lib/punch-out-correction-rules";

describe("punch-out correction authorization", () => {
  it("allows Manager and Admin to review corrections", () => {
    expect(canManagePunchOutCorrections("manager")).toBe(true);
    expect(canManagePunchOutCorrections("admin")).toBe(true);
  });

  it("blocks Developer from approving, rejecting, or manual punch-out", () => {
    expect(canManagePunchOutCorrections("developer")).toBe(false);
  });
});

describe("punch-out correction date window", () => {
  it("allows past working days within 62 days like punch-in", () => {
    expect(
      isPunchOutCorrectionDateAllowed("2026-09-11", "2026-09-11", "2026-09-10"),
    ).toBe(true);
    expect(
      isPunchOutCorrectionDateAllowed("2026-09-10", "2026-09-11", "2026-09-10"),
    ).toBe(true);
    expect(
      isPunchOutCorrectionDateAllowed("2026-09-01", "2026-09-17", "2026-09-16"),
    ).toBe(true);
    expect(
      isPunchOutCorrectionDateAllowed("2026-09-13", "2026-09-17", "2026-09-16"),
    ).toBe(false); // Sunday
    expect(
      isPunchOutCorrectionDateAllowed("2026-07-01", "2026-09-17", "2026-09-16"),
    ).toBe(false); // beyond 62 days
  });
});

describe("punch-out correction attendance prerequisites", () => {
  it("requires an existing open attendance record", () => {
    expect(() =>
      assertAttendanceOpenForCorrection({
        exists: false,
        state: null,
        hasPunchOut: false,
      }),
    ).toThrow("No attendance record found for this date.");

    expect(() =>
      assertAttendanceOpenForCorrection({
        exists: true,
        state: "punched_out",
        hasPunchOut: true,
      }),
    ).toThrow(
      "Punch-out correction can only be requested while attendance is still open.",
    );

    expect(() =>
      assertAttendanceOpenForCorrection({
        exists: true,
        state: "working",
        hasPunchOut: false,
      }),
    ).not.toThrow();
  });

  it("blocks approval when attendance is already punched out", () => {
    expect(() =>
      assertAttendanceStillOpenForApproval({
        exists: true,
        state: "punched_out",
        hasPunchOut: true,
      }),
    ).toThrow(
      "Attendance has already been punched out and cannot be overwritten.",
    );
  });
});

describe("requested punch-out time validation", () => {
  const punchInAt = new Date("2026-09-11T03:35:00.000Z"); // 09:05 IST
  const workDate = "2026-09-11";

  it("requires punch-out after punch-in", () => {
    expect(() =>
      assertRequestedPunchOutIsValid({
        punchInAt,
        requestedPunchOutAt: new Date("2026-09-11T03:00:00.000Z"),
        now: new Date("2026-09-11T14:00:00.000Z"),
        workDate,
        workDateOfRequested: workDate,
      }),
    ).toThrow("Requested punch-out time must be after punch-in time.");
  });

  it("rejects future punch-out times", () => {
    expect(() =>
      assertRequestedPunchOutIsValid({
        punchInAt,
        requestedPunchOutAt: new Date("2026-09-11T15:00:00.000Z"),
        now: new Date("2026-09-11T14:00:00.000Z"),
        workDate,
        workDateOfRequested: workDate,
      }),
    ).toThrow("Requested punch-out time cannot be in the future.");
  });

  it("accepts a valid past punch-out on the work date", () => {
    expect(() =>
      assertRequestedPunchOutIsValid({
        punchInAt,
        requestedPunchOutAt: new Date("2026-09-11T13:02:00.000Z"),
        now: new Date("2026-09-11T14:00:00.000Z"),
        workDate,
        workDateOfRequested: workDate,
      }),
    ).not.toThrow();
  });
});

describe("correction request review state", () => {
  it("blocks re-review of approved or rejected requests", () => {
    expect(() => assertRequestPending("approved")).toThrow(
      "This correction request has already been reviewed.",
    );
    expect(() => assertRequestPending("rejected")).toThrow(
      "This correction request has already been reviewed.",
    );
    expect(() => assertRequestPending("pending")).not.toThrow();
  });
});

describe("reason and review note validation", () => {
  it("requires trimmed reason and review note within 2000 characters", () => {
    expect(() => validateCorrectionReason("   ")).toThrow(
      "A reason is required.",
    );
    expect(validateCorrectionReason("  Forgot to punch out.  ")).toBe(
      "Forgot to punch out.",
    );
    expect(() => validateCorrectionReason("x".repeat(2001))).toThrow(
      "Reason must be at most 2000 characters.",
    );

    expect(() => validateReviewNote("")).toThrow("A review note is required.");
    expect(validateReviewNote(" Could not verify. ")).toBe("Could not verify.");
  });
});

describe("punch-in correction date window", () => {
  it("allows past working days within 62 days and blocks Sundays", () => {
    expect(isPunchInCorrectionDateAllowed("2026-09-10", "2026-09-11")).toBe(
      true,
    );
    expect(isPunchInCorrectionDateAllowed("2026-09-12", "2026-09-12")).toBe(
      true,
    ); // Saturday working day
    expect(isPunchInCorrectionDateAllowed("2026-09-13", "2026-09-14")).toBe(
      false,
    ); // Sunday week off
    expect(isPunchInCorrectionDateAllowed("2026-07-01", "2026-09-11")).toBe(
      false,
    );
  });
});

describe("correction type normalization", () => {
  it("defaults legacy/unknown values to punch_out", () => {
    expect(normalizeCorrectionType(undefined)).toBe("punch_out");
    expect(normalizeCorrectionType("punch_in")).toBe("punch_in");
    expect(normalizeCorrectionType("punch_in_and_out")).toBe(
      "punch_in_and_out",
    );
  });
});

describe("requested punch-in time validation", () => {
  const now = new Date("2026-09-11T14:00:00.000Z");
  const workDate = "2026-09-11";

  it("requires punch-in before existing punch-out", () => {
    expect(() =>
      assertRequestedPunchInIsValid({
        requestedPunchInAt: new Date("2026-09-11T03:35:00.000Z"),
        now,
        workDate,
        workDateOfRequested: workDate,
        existingPunchOutAt: new Date("2026-09-11T12:40:00.000Z"),
      }),
    ).not.toThrow();

    expect(() =>
      assertRequestedPunchInIsValid({
        requestedPunchInAt: new Date("2026-09-11T13:00:00.000Z"),
        now,
        workDate,
        workDateOfRequested: workDate,
        existingPunchOutAt: new Date("2026-09-11T12:40:00.000Z"),
      }),
    ).toThrow("Requested punch-in time must be before punch-out time.");
  });
});
