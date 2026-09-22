/** Pure validation and business rules for Leave Management. */
import { isIndiaWeekend, nextDateKey } from "@/lib/attendance-month";

export const LEAVE_TYPES = ["casual", "sick", "other"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = ["pending", "approved", "rejected"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const LEAVE_DAY_PORTIONS = [
  "full",
  "half",
  "first_half",
  "second_half",
  "hours_1",
  "hours_2",
  "hours_3",
] as const;
export type LeaveDayPortion = (typeof LEAVE_DAY_PORTIONS)[number];

export type LeaveHolidayInfo = {
  kind: "holiday" | "weekoff";
  name: string;
};

export type LeaveBlockedDay = {
  date: string;
  reason: "sunday" | "weekoff" | "holiday";
  name?: string;
};

export function isLeaveType(value: unknown): value is LeaveType {
  return typeof value === "string" && (LEAVE_TYPES as readonly string[]).includes(value);
}

export function isLeaveDayPortion(value: unknown): value is LeaveDayPortion {
  return (
    typeof value === "string" &&
    (LEAVE_DAY_PORTIONS as readonly string[]).includes(value)
  );
}

/** Half-day leave (legacy `half`, 1st half, or 2nd half). */
export function isHalfDayPortion(
  portion: LeaveDayPortion | string | null | undefined,
) {
  return (
    portion === "half" ||
    portion === "first_half" ||
    portion === "second_half"
  );
}

/** Short hourly leave (1–3 hours). */
export function isHourlyLeavePortion(
  portion: LeaveDayPortion | string | null | undefined,
) {
  return portion === "hours_1" || portion === "hours_2" || portion === "hours_3";
}

/** Half-day or hourly — always a single calendar date. */
export function isPartialDayLeavePortion(
  portion: LeaveDayPortion | string | null | undefined,
) {
  return isHalfDayPortion(portion) || isHourlyLeavePortion(portion);
}

export function leaveHourlyHours(
  portion: LeaveDayPortion | string | null | undefined,
): 1 | 2 | 3 | null {
  if (portion === "hours_1") return 1;
  if (portion === "hours_2") return 2;
  if (portion === "hours_3") return 3;
  return null;
}

/** Convert hourly leave to day fraction (8-hour workday basis). */
export function leaveHoursToTotalDays(hours: 1 | 2 | 3) {
  return hours / 8;
}

export function canManageLeaveRequests(role: string) {
  return role === "admin" || role === "manager";
}

export function leaveTypeLabel(type: LeaveType) {
  if (type === "casual") return "Casual Leave";
  if (type === "sick") return "Sick Leave";
  return "Other";
}

export function leaveDayPortionLabel(portion: LeaveDayPortion) {
  if (portion === "first_half") return "1st Half";
  if (portion === "second_half") return "2nd Half";
  if (portion === "half") return "Half Day";
  if (portion === "hours_1") return "1 Hour";
  if (portion === "hours_2") return "2 Hours";
  if (portion === "hours_3") return "3 Hours";
  return "Full Day";
}

export function validateLeaveReason(reason: string) {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("A reason is required.");
  if (trimmed.length > 2000) throw new Error("Reason must be at most 2000 characters.");
  return trimmed;
}

/** Optional manager note when applying leave for an employee. */
export function validateLeaveManagerRemark(remark: string | undefined | null) {
  const trimmed = (remark ?? "").trim();
  if (trimmed.length > 2000) {
    throw new Error("Remark must be at most 2000 characters.");
  }
  return trimmed;
}

export type LeaveStatusSummaryCounts = {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
};

/** Build status card counts from Mongo $group rows (or any status→count map). */
export function buildLeaveStatusSummary(
  rows: ReadonlyArray<{ status: string; count: number }>,
): LeaveStatusSummaryCounts {
  const summary: LeaveStatusSummaryCounts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  };
  for (const row of rows) {
    const count = Math.max(0, Math.floor(row.count));
    if (row.status === "pending") summary.pending += count;
    else if (row.status === "approved") summary.approved += count;
    else if (row.status === "rejected") summary.rejected += count;
    else continue;
    summary.total += count;
  }
  return summary;
}

export function validateRejectionReason(reason: string) {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("A rejection reason is required.");
  if (trimmed.length > 2000) {
    throw new Error("Rejection reason must be at most 2000 characters.");
  }
  return trimmed;
}

export function assertLeaveRequestPending(status: LeaveStatus) {
  if (status !== "pending") {
    throw new Error("This leave request has already been reviewed.");
  }
}

/** Pending or approved leave may be rejected by Manager/Admin. */
export function assertLeaveCanBeRejected(status: LeaveStatus) {
  if (status !== "pending" && status !== "approved") {
    throw new Error("Only pending or approved leave can be rejected.");
  }
}

export function isValidLeaveDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Max inclusive calendar days allowed in a single leave application. */
export const MAX_LEAVE_APPLICATION_DAYS = 30;

/** Inclusive calendar-day count for a leave range (YYYY-MM-DD). */
export function countLeaveCalendarDays(startDate: string, endDate: string) {
  return eachDateKeyInclusive(startDate, endDate).length;
}

/** Inclusive date keys from start through end (YYYY-MM-DD). */
export function eachDateKeyInclusive(startDate: string, endDate: string) {
  if (startDate > endDate) return [];
  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = nextDateKey(cursor);
  }
  return dates;
}

function holidayLookup(
  holidayByDate: Map<string, LeaveHolidayInfo> | undefined,
  date: string,
) {
  return holidayByDate?.get(date) ?? null;
}

/** True when the date is Sunday, company week off, or holiday. */
export function isLeaveNonWorkingDate(
  date: string,
  holidayByDate?: Map<string, LeaveHolidayInfo>,
) {
  const holiday = holidayLookup(holidayByDate, date);
  if (holiday?.kind === "weekoff" || holiday?.kind === "holiday") return true;
  return isIndiaWeekend(date);
}

/** Sundays, company week offs, and holidays cannot be leave days. */
export function findLeaveBlockedDays(
  startDate: string,
  endDate: string,
  holidayByDate?: Map<string, LeaveHolidayInfo>,
): LeaveBlockedDay[] {
  const blocked: LeaveBlockedDay[] = [];
  for (const date of eachDateKeyInclusive(startDate, endDate)) {
    const holiday = holidayLookup(holidayByDate, date);
    if (holiday?.kind === "weekoff") {
      blocked.push({ date, reason: "weekoff", name: holiday.name });
      continue;
    }
    if (holiday?.kind === "holiday") {
      blocked.push({ date, reason: "holiday", name: holiday.name });
      continue;
    }
    if (isIndiaWeekend(date)) {
      blocked.push({ date, reason: "sunday" });
    }
  }
  return blocked;
}

/** Display label for a blocked leave day (used in error copy). */
export function formatLeaveBlockedDayLabel(day: LeaveBlockedDay) {
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day.date}T12:00:00Z`));

  if (day.reason === "sunday") {
    return `Sunday (${dateLabel})`;
  }
  if (day.reason === "weekoff") {
    const name = day.name?.trim();
    return name
      ? `week off ${name} (${dateLabel})`
      : `week off (${dateLabel})`;
  }
  const name = day.name?.trim();
  return name ? `holiday ${name} (${dateLabel})` : `holiday (${dateLabel})`;
}

export function formatLeaveBlockedDaysError(blocked: LeaveBlockedDay[]) {
  if (blocked.length === 0) return null;
  if (blocked.length === 1) {
    return `Cannot apply leave on ${formatLeaveBlockedDayLabel(blocked[0])}.`;
  }
  return `Cannot apply leave on non-working days: ${blocked
    .map(formatLeaveBlockedDayLabel)
    .join(", ")}.`;
}

/** Working days in range — Sundays (week off) and company holidays excluded. */
export function countLeaveWorkingDays(
  startDate: string,
  endDate: string,
  holidayByDate?: Map<string, LeaveHolidayInfo>,
) {
  return eachDateKeyInclusive(startDate, endDate).filter(
    (date) => !isLeaveNonWorkingDate(date, holidayByDate),
  ).length;
}

export function assertLeaveDateRangeValid(input: {
  startDate: string;
  endDate: string;
  today: string;
  dayPortion?: LeaveDayPortion;
  /** Admin/Manager may backdate; employees may not start before today. */
  allowPastStart?: boolean;
  holidayByDate?: Map<string, LeaveHolidayInfo>;
}) {
  if (!isValidLeaveDateKey(input.startDate) || !isValidLeaveDateKey(input.endDate)) {
    throw new Error("Invalid leave dates.");
  }
  if (input.startDate > input.endDate) {
    throw new Error("From date cannot be after to date.");
  }

  const calendarDays = countLeaveCalendarDays(input.startDate, input.endDate);
  if (calendarDays > MAX_LEAVE_APPLICATION_DAYS) {
    throw new Error(
      `Leave cannot be applied for more than ${MAX_LEAVE_APPLICATION_DAYS} days.`,
    );
  }

  const dayPortion = input.dayPortion ?? "full";
  if (isPartialDayLeavePortion(dayPortion)) {
    if (input.startDate !== input.endDate) {
      throw new Error(
        isHourlyLeavePortion(dayPortion)
          ? "Hourly leave must be for a single date."
          : "Half-day leave must be for a single date.",
      );
    }
  }

  const isSingleDay = input.startDate === input.endDate;
  // Single-day / partial-day leave cannot land on a week off or holiday.
  // Multi-day leave keeps the selected range but counts only working days.
  if (isSingleDay) {
    const blocked = findLeaveBlockedDays(
      input.startDate,
      input.endDate,
      input.holidayByDate,
    );
    const blockedError = formatLeaveBlockedDaysError(blocked);
    if (blockedError) {
      throw new Error(blockedError);
    }
  }

  const workingDays = countLeaveWorkingDays(
    input.startDate,
    input.endDate,
    input.holidayByDate,
  );
  if (workingDays <= 0) {
    throw new Error("Leave range must include at least one working day.");
  }

  const hourlyHours = leaveHourlyHours(dayPortion);
  const totalDays = hourlyHours
    ? leaveHoursToTotalDays(hourlyHours)
    : isHalfDayPortion(dayPortion)
      ? 0.5
      : workingDays;

  // Allow late applications within 62 days; block far-future spans beyond 1 year.
  const todayMs = new Date(`${input.today}T12:00:00Z`).getTime();
  const startMs = new Date(`${input.startDate}T12:00:00Z`).getTime();
  const endMs = new Date(`${input.endDate}T12:00:00Z`).getTime();
  const pastDays = (todayMs - startMs) / 86_400_000;
  const futureDays = (endMs - todayMs) / 86_400_000;
  if (input.allowPastStart === false && input.startDate < input.today) {
    throw new Error("Leave cannot start on a past date.");
  }
  if (pastDays > 62) {
    throw new Error("Leave cannot start more than 62 days in the past.");
  }
  if (futureDays > 365) {
    throw new Error("Leave cannot end more than 365 days in the future.");
  }
  return totalDays;
}

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Inclusive coverage on working days only (week offs / holidays skipped). */
export function isLeaveCoveringDate(
  leave: { startDate: string; endDate: string },
  date: string,
  holidayByDate?: Map<string, LeaveHolidayInfo>,
) {
  if (leave.startDate > date || date > leave.endDate) return false;
  return !isLeaveNonWorkingDate(date, holidayByDate);
}

export function formatLeaveDateRangeLabel(startDate: string, endDate: string) {
  if (startDate === endDate) return startDate;
  return `${startDate} to ${endDate}`;
}

export function normalizeLeaveDayPortion(
  value: unknown,
): LeaveDayPortion {
  return isLeaveDayPortion(value) ? value : "full";
}

export type FullDayLeavePunchCancelPlan = { action: "reject" };

/**
 * When an employee punches in on an approved/pending full-day leave date,
 * reject that leave request so both employee and manager leave tables show Rejected.
 * Half-day leave is left unchanged.
 */
export function planFullDayLeaveCancelForPunchDate(input: {
  startDate: string;
  endDate: string;
  dayPortion?: LeaveDayPortion | string | null;
  status: LeaveStatus;
  punchDate: string;
  holidayByDate?: Map<string, LeaveHolidayInfo>;
}): FullDayLeavePunchCancelPlan | null {
  if (input.status !== "approved" && input.status !== "pending") return null;
  if (isHalfDayPortion(input.dayPortion) || isHourlyLeavePortion(input.dayPortion)) {
    return null;
  }
  if (
    !isLeaveCoveringDate(
      { startDate: input.startDate, endDate: input.endDate },
      input.punchDate,
      input.holidayByDate,
    )
  ) {
    return null;
  }
  return { action: "reject" };
}

export const LEAVE_CANCELLED_ON_PUNCH_REASON =
  "Cancelled automatically: employee punched in on this leave day.";

/**
 * Most recent leave requests for one employee, excluding the request being viewed.
 * Sorted by end date, then start date, then applied time (newest first).
 */
export function selectPreviousLeaveRequests<
  T extends {
    id: string;
    userId: string;
    startDate: string;
    endDate: string;
    appliedAt: string;
  },
>(
  requests: T[],
  options: { userId: string; excludeId: string; limit?: number },
): T[] {
  const limit = options.limit ?? 3;
  return requests
    .filter(
      (request) =>
        request.userId === options.userId && request.id !== options.excludeId,
    )
    .sort((a, b) => {
      if (a.endDate !== b.endDate) return b.endDate.localeCompare(a.endDate);
      if (a.startDate !== b.startDate) {
        return b.startDate.localeCompare(a.startDate);
      }
      return b.appliedAt.localeCompare(a.appliedAt);
    })
    .slice(0, limit);
}

