/** Pure validation rules for attendance punch-in / punch-out correction flows. */
import { isIndiaWeekend } from "@/lib/attendance-month";

export type PunchOutRequestStatus = "pending" | "approved" | "rejected";
export type AttendanceCorrectionType =
  | "punch_out"
  | "punch_in"
  | "punch_in_and_out";

export function canManagePunchOutCorrections(role: string) {
  return role === "admin" || role === "manager";
}

export function isPunchOutCorrectionDateAllowed(
  workDate: string,
  today: string,
  _yesterday?: string,
) {
  // Same window as punch-in / report attendance: past working days within 62 days.
  return isPunchInCorrectionDateAllowed(workDate, today);
}

/** Punch-in / report-attendance: any past working day within 62 days (not Sunday). */
export function isPunchInCorrectionDateAllowed(workDate: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return false;
  if (workDate > today) return false;
  if (isIndiaWeekend(workDate)) return false;
  const todayMs = new Date(`${today}T12:00:00Z`).getTime();
  const workMs = new Date(`${workDate}T12:00:00Z`).getTime();
  const diffDays = (todayMs - workMs) / 86_400_000;
  return diffDays >= 0 && diffDays <= 62;
}

export function validateCorrectionReason(reason: string) {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("A reason is required.");
  if (trimmed.length > 2000) throw new Error("Reason must be at most 2000 characters.");
  return trimmed;
}

export function validateReviewNote(reviewNote: string) {
  const trimmed = reviewNote.trim();
  if (!trimmed) throw new Error("A review note is required.");
  if (trimmed.length > 2000) throw new Error("Review note must be at most 2000 characters.");
  return trimmed;
}

export function assertRequestedPunchOutIsValid(input: {
  punchInAt: Date;
  requestedPunchOutAt: Date;
  now: Date;
  workDate: string;
  workDateOfRequested: string;
}) {
  if (Number.isNaN(input.requestedPunchOutAt.getTime())) {
    throw new Error("Invalid punch-out time.");
  }
  if (input.requestedPunchOutAt.getTime() <= input.punchInAt.getTime()) {
    throw new Error("Requested punch-out time must be after punch-in time.");
  }
  if (input.requestedPunchOutAt.getTime() > input.now.getTime()) {
    throw new Error("Requested punch-out time cannot be in the future.");
  }
  if (input.workDateOfRequested !== input.workDate) {
    throw new Error("Requested punch-out time must fall on the selected work date.");
  }
}

export function assertRequestedPunchInIsValid(input: {
  requestedPunchInAt: Date;
  now: Date;
  workDate: string;
  workDateOfRequested: string;
  existingPunchOutAt?: Date | null;
}) {
  if (Number.isNaN(input.requestedPunchInAt.getTime())) {
    throw new Error("Invalid punch-in time.");
  }
  if (input.requestedPunchInAt.getTime() > input.now.getTime()) {
    throw new Error("Requested punch-in time cannot be in the future.");
  }
  if (input.workDateOfRequested !== input.workDate) {
    throw new Error("Requested punch-in time must fall on the selected work date.");
  }
  if (
    input.existingPunchOutAt &&
    input.requestedPunchInAt.getTime() >= input.existingPunchOutAt.getTime()
  ) {
    throw new Error("Requested punch-in time must be before punch-out time.");
  }
}

export function assertAttendanceOpenForCorrection(input: {
  exists: boolean;
  state: "working" | "punched_out" | null;
  hasPunchOut: boolean;
}) {
  if (!input.exists) throw new Error("No attendance record found for this date.");
  if (input.state !== "working" || input.hasPunchOut) {
    throw new Error("Punch-out correction can only be requested while attendance is still open.");
  }
}

export function assertRequestPending(status: PunchOutRequestStatus) {
  if (status === "approved" || status === "rejected") {
    throw new Error("This correction request has already been reviewed.");
  }
  if (status !== "pending") {
    throw new Error("This correction request has already been reviewed.");
  }
}

export function assertAttendanceStillOpenForApproval(input: {
  exists: boolean;
  state: "working" | "punched_out" | null;
  hasPunchOut: boolean;
}) {
  if (!input.exists) throw new Error("Attendance record not found.");
  if (input.state !== "working" || input.hasPunchOut) {
    throw new Error("Attendance has already been punched out and cannot be overwritten.");
  }
}

export function normalizeCorrectionType(
  value: string | null | undefined,
): AttendanceCorrectionType {
  if (value === "punch_in" || value === "punch_in_and_out" || value === "punch_out") {
    return value;
  }
  return "punch_out";
}
