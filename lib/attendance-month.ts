/** Pure IST month-ledger helpers for attendance self-review. */
import type { Role } from "@/lib/roles";
import {
  resolvePunchInSource,
  resolvePunchOutSource,
  type PunchOutSource,
} from "@/lib/punch-out-audit";

const INDIA_TIME_ZONE = "Asia/Kolkata";

export type AttendanceDayStatus =
  | "present"
  | "late"
  | "working"
  | "missing_punch_out"
  | "missing_punch_in"
  | "absent"
  | "weekend"
  | "holiday"
  | "leave"
  | "future"
  | "regularized"
  | "manual";

export type AttendanceDayCorrection = {
  id: string;
  status: "pending" | "approved" | "rejected";
  correctionType?: "punch_out" | "punch_in" | "punch_in_and_out";
  requestedPunchInAt: string | null;
  requestedPunchOutAt: string | null;
  reason: string | null;
  reviewedAt: string | null;
  reviewNote?: string | null;
  reviewedByRole?: Role | null;
};

/** Leave overlay for calendar — approved becomes LEAVE; rejected shows reason only. */
export type AttendanceDayLeaveInfo = {
  id: string;
  status: "approved" | "rejected";
  dayPortion:
    | "full"
    | "half"
    | "first_half"
    | "second_half"
    | "hours_1"
    | "hours_2"
    | "hours_3";
  leaveType: "casual" | "sick" | "other";
  reason: string | null;
  rejectionReason: string | null;
};

export type AttendanceDayHolidayInfo = {
  id: string;
  name: string;
  kind: "holiday" | "weekoff";
};

export type AttendanceDayRecord = {
  id: string;
  workDate: string;
  punchInAt?: string;
  punchOutAt?: string;
  classification: "on_time" | "late";
  state: "working" | "punched_out";
  punchInSource?: PunchOutSource | null;
  punchOutSource?: PunchOutSource | null;
  punchOutRecordedByUserId?: string | null;
  punchOutRecordedByRole?: Role | null;
  punchInRecordedByUserId?: string | null;
  punchInRecordedByRole?: Role | null;
  punchOutAudit?: {
    source: PunchOutSource;
    recordedBy: {
      id: string;
      displayName: string | null;
      email: string;
      role: Role;
    } | null;
    recordedAt: string | null;
    reason: string | null;
    requestStatus: "approved" | null;
    requestedAt: string | null;
  } | null;
  punchInAudit?: {
    source: PunchOutSource;
    recordedBy: {
      id: string;
      displayName: string | null;
      email: string;
      role: Role;
    } | null;
    recordedAt: string | null;
    reason: string | null;
    requestStatus: "approved" | null;
    requestedAt: string | null;
  } | null;
};

export type AttendanceDay = {
  date: string;
  dayOfMonth: number;
  status: AttendanceDayStatus;
  attendance: AttendanceDayRecord | null;
  punchInAt: string | null;
  punchOutAt: string | null;
  totalHours: number | null;
  punchOutSource: PunchOutSource | null;
  correctionRequest: AttendanceDayCorrection | null;
  leaveInfo: AttendanceDayLeaveInfo | null;
  holidayInfo: AttendanceDayHolidayInfo | null;
};

export type AttendanceMonthSummary = {
  present: number;
  workingDays: number;
  late: number;
  hours: number;
  needsAction: number;
  leave: number;
  regularized: number;
  manual: number;
};

export type AttendanceMonthLedger = {
  month: string;
  range: { from: string; to: string };
  summary: AttendanceMonthSummary;
  days: AttendanceDay[];
};

function indiaParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "00";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
  };
}

/** YYYY-MM-DD in Asia/Kolkata. */
export function toIndiaDateKey(date = new Date()) {
  const parts = indiaParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** YYYY-MM in Asia/Kolkata. */
export function toIndiaMonthKey(date = new Date()) {
  return toIndiaDateKey(date).slice(0, 7);
}

export function isValidMonthKey(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

export function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Inclusive start + exclusive end date keys for a month. */
export function monthRangeKeys(monthKey: string) {
  if (!isValidMonthKey(monthKey)) throw new Error("Invalid month key.");
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const from = `${monthKey}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const toExclusive = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { from, toExclusive };
}

export function shiftMonthKey(monthKey: string, delta: number) {
  const { from } = monthRangeKeys(monthKey);
  const [yearText, monthText] = from.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const index = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export function formatMonthTitle(monthKey: string) {
  const { from } = monthRangeKeys(monthKey);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${from}T12:00:00Z`));
}

/** 0 = Sunday … 6 = Saturday in Asia/Kolkata. */
export function indiaWeekday(dateKey: string) {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: INDIA_TIME_ZONE,
    weekday: "short",
  }).format(new Date(`${dateKey}T12:00:00+05:30`));
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[label] ?? 0;
}

export function isIndiaWeekend(dateKey: string) {
  // Business week: Monday–Saturday; Sunday only is weekend.
  return indiaWeekday(dateKey) === 0;
}

export function eachDateKeyInMonth(monthKey: string) {
  const { from, toExclusive } = monthRangeKeys(monthKey);
  const dates: string[] = [];
  let cursor = from;
  while (cursor < toExclusive) {
    dates.push(cursor);
    cursor = nextDateKey(cursor);
  }
  return dates;
}

export function nextDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Add (or subtract) whole calendar days from a YYYY-MM-DD key without TZ drift. */
export function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function hoursBetween(punchInAt: string, punchOutAt: string) {
  const start = new Date(punchInAt).getTime();
  const end = new Date(punchOutAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.round(((end - start) / (1000 * 60 * 60)) * 100) / 100;
}

/** Fixed daily deduction for lunch + tea break (1 hour). */
export const LUNCH_AND_TEA_BREAK_HOURS = 1;

/** Net worked hours after subtracting the standard lunch + tea break. */
export function workedHoursBetween(punchInAt: string, punchOutAt: string) {
  const gross = hoursBetween(punchInAt, punchOutAt);
  if (gross == null) return null;
  return Math.max(
    0,
    Math.round((gross - LUNCH_AND_TEA_BREAK_HOURS) * 100) / 100,
  );
}

export function formatHoursShort(hours: number | null) {
  if (hours == null || !Number.isFinite(hours)) return "—";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function getAttendanceDayStatus(input: {
  date: string;
  today: string;
  attendance: {
    punchInAt?: string | null;
    punchOutAt?: string | null;
    classification?: "on_time" | "late" | null;
    punchInSource?: PunchOutSource | null;
    punchOutSource?: PunchOutSource | null;
  } | null;
  isHoliday?: boolean;
  isWeekOff?: boolean;
}): AttendanceDayStatus {
  if (isIndiaWeekend(input.date) || input.isWeekOff) return "weekend";
  if (input.isHoliday) return "holiday";
  if (input.date > input.today) return "future";

  const attendance = input.attendance;
  if (!attendance) return "absent";

  // Punch-out without punch-in (rare/legacy-edge) → missing in
  if (attendance.punchOutAt && !attendance.punchInAt) {
    return "missing_punch_in";
  }

  if (!attendance.punchInAt) return "absent";

  if (!attendance.punchOutAt) {
    return input.date === input.today ? "working" : "missing_punch_out";
  }

  const inSource = resolvePunchInSource({
    punchInAt: attendance.punchInAt,
    punchInSource: attendance.punchInSource,
  });
  const outSource = resolvePunchOutSource({
    punchOutAt: attendance.punchOutAt,
    punchOutSource: attendance.punchOutSource,
  });
  if (inSource === "regularization" || outSource === "regularization") {
    return "regularized";
  }
  if (inSource === "manual" || outSource === "manual") return "manual";
  if (attendance.classification === "late") return "late";
  return "present";
}

export function buildAttendanceMonth(input: {
  month: string;
  today: string;
  attendanceByDate: Map<string, AttendanceDayRecord>;
  correctionByWorkDate: Map<string, AttendanceDayCorrection>;
  /** Approved leave date keys only — pending/rejected must not mark LEAVE. */
  approvedLeaveDates?: Set<string> | ReadonlySet<string>;
  /** Optional leave metadata (approved LEAVE + rejected reason display). */
  leaveInfoByDate?: Map<string, AttendanceDayLeaveInfo>;
  /** Company holidays keyed by date. */
  holidayByDate?: Map<string, AttendanceDayHolidayInfo>;
  isHoliday?: (date: string) => boolean;
}): AttendanceMonthLedger {
  const { from, toExclusive } = monthRangeKeys(input.month);
  const days: AttendanceDay[] = eachDateKeyInMonth(input.month).map((date) => {
    const attendance = input.attendanceByDate.get(date) ?? null;
    const correctionRequest = input.correctionByWorkDate.get(date) ?? null;
    const leaveInfo = input.leaveInfoByDate?.get(date) ?? null;
    const holidayInfo = input.holidayByDate?.get(date) ?? null;
    const holidayKind = holidayInfo?.kind ?? null;
    const isWeekOff = holidayKind === "weekoff";
    const isHoliday =
      holidayKind === "holiday" ||
      (!holidayInfo && (input.isHoliday?.(date) ?? false));
    let status = getAttendanceDayStatus({
      date,
      today: input.today,
      attendance,
      isHoliday,
      isWeekOff,
    });
    // Priority: week off → holiday → approved leave (only when no punch) → attendance.
    if (
      status !== "weekend" &&
      !isHoliday &&
      !attendance?.punchInAt &&
      (input.approvedLeaveDates?.has(date) || leaveInfo?.status === "approved")
    ) {
      status = "leave";
    }
    const punchInAt = attendance?.punchInAt ?? null;
    const punchOutAt = attendance?.punchOutAt ?? null;
    const totalHours =
      punchInAt && punchOutAt ? workedHoursBetween(punchInAt, punchOutAt) : null;
    const punchOutSource = attendance
      ? resolvePunchOutSource(attendance)
      : null;

    return {
      date,
      dayOfMonth: Number(date.slice(8, 10)),
      status,
      attendance,
      punchInAt,
      punchOutAt,
      totalHours,
      punchOutSource,
      correctionRequest,
      leaveInfo,
      holidayInfo,
    };
  });

  return {
    month: input.month,
    range: { from, to: toExclusive },
    summary: summarizeAttendanceMonth(days, input.today),
    days,
  };
}

export function summarizeAttendanceMonth(
  days: AttendanceDay[],
  today: string,
): AttendanceMonthSummary {
  let present = 0;
  let workingDays = 0;
  let late = 0;
  let totalMinutes = 0;
  let needsAction = 0;
  let leave = 0;
  let regularized = 0;
  let manual = 0;

  for (const day of days) {
    // Full-month working calendar: total days minus week-off and holiday.
    if (day.status !== "weekend" && day.status !== "holiday") {
      workingDays += 1;
    }

    // Leave count covers the whole month (including upcoming approved leave).
    if (day.status === "leave") {
      leave += 1;
    }

    if (day.date > today) continue;
    if (
      day.status === "weekend" ||
      day.status === "holiday" ||
      day.status === "leave"
    ) {
      continue;
    }

    const countedPresent =
      day.status === "present" ||
      day.status === "late" ||
      day.status === "regularized" ||
      day.status === "manual" ||
      day.status === "working" ||
      // Today with punch-in (open day) always counts toward Present.
      (day.date === today && Boolean(day.punchInAt));

    if (countedPresent) present += 1;
    if (day.status === "late") late += 1;
    if (day.status === "regularized") regularized += 1;
    if (day.status === "manual") manual += 1;
    if (typeof day.totalHours === "number") {
      // Accumulate whole minutes so 60 min = 1 hour (not decimal/100ths).
      totalMinutes += Math.round(day.totalHours * 60);
    }

    // Needs action = missing punch only (not absent).
    if (
      day.status === "missing_punch_out" ||
      day.status === "missing_punch_in"
    ) {
      needsAction += 1;
    }
  }

  return {
    present,
    workingDays,
    late,
    hours: totalMinutes / 60,
    needsAction,
    leave,
    regularized,
    manual,
  };
}

/** Monday-first calendar cells including leading/trailing adjacent-month dates. */
export function buildCalendarGrid(monthKey: string) {
  const dates = eachDateKeyInMonth(monthKey);
  const first = dates[0];
  const last = dates[dates.length - 1];
  const firstWeekday = indiaWeekday(first); // 0 Sun
  const mondayOffset = (firstWeekday + 6) % 7; // Mon=0
  const cells: Array<{ date: string; inMonth: boolean }> = [];

  for (let i = mondayOffset; i > 0; i -= 1) {
    const date = new Date(`${first}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - i);
    cells.push({ date: date.toISOString().slice(0, 10), inMonth: false });
  }
  for (const date of dates) cells.push({ date, inMonth: true });

  const trailing = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= trailing; i += 1) {
    const date = new Date(`${last}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + i);
    cells.push({ date: date.toISOString().slice(0, 10), inMonth: false });
  }
  return cells;
}
