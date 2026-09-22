/** Pure Monthly Attendance Report generation — aggregation over attendance + leave. */
import {
  eachDateKeyInMonth,
  formatMonthTitle,
  getAttendanceDayStatus,
  isIndiaWeekend,
  isValidDateKey,
  isValidMonthKey,
  monthRangeKeys,
  shiftMonthKey,
} from "@/lib/attendance-month";
import {
  OFFICE_END_MINUTES,
  OFFICE_START_MINUTES,
  classifyOfficePunchIn,
  classifyOfficePunchOut,
  expectedOfficeEndMinutes,
} from "@/lib/operation-rules";
import {
  leaveDayPortionLabel,
  leaveTypeLabel,
  type LeaveDayPortion,
  type LeaveType,
} from "@/lib/leave-rules";

export const ATTENDANCE_REPORT_ACTIONS = [
  "Arrived Late",
  "Going Early",
  "On Leave",
  "Absent",
  "Missing Punch",
  "Other",
] as const;

export type AttendanceReportAction =
  (typeof ATTENDANCE_REPORT_ACTIONS)[number];

export type AttendanceReportSource = "attendance" | "leave" | "manual";

export type AttendanceReportEmployee = {
  id: string;
  displayName: string | null;
  email: string;
};

export type AttendanceReportAttendanceInput = {
  userId: string;
  workDate: string;
  punchInAt?: string | null;
  punchOutAt?: string | null;
  classification?: "on_time" | "late" | null;
  punchInSource?: string | null;
  punchOutSource?: string | null;
};

export type AttendanceReportLeaveInput = {
  id: string;
  userId: string;
  leaveType: LeaveType;
  dayPortion: LeaveDayPortion;
  startDate: string;
  endDate: string;
  status: "pending" | "approved" | "rejected";
};

export type AttendanceReportHolidayInput = {
  date: string;
  kind: "holiday" | "weekoff";
};

export type AttendanceReportAutoEntry = {
  autoKey: string;
  date: string;
  employeeId: string;
  employeeName: string;
  action: AttendanceReportAction;
  details: string;
  source: "attendance" | "leave";
};

export type AttendanceReportPersistedOverlay = {
  id: string;
  autoKey: string | null;
  date: string;
  employeeId: string;
  employeeName?: string;
  action: AttendanceReportAction;
  details: string;
  managerRemark: string;
  source: AttendanceReportSource;
  deleted?: boolean;
};

export type AttendanceReportEntry = {
  id: string;
  autoKey: string | null;
  date: string;
  employeeId: string;
  employeeName: string;
  action: AttendanceReportAction;
  details: string;
  managerRemark: string;
  source: AttendanceReportSource;
  isManual: boolean;
  isEditable: boolean;
};

export type AttendanceReportSummary = {
  totalEmployees: number;
  lateArrivals: number;
  earlyDepartures: number;
  leaves: number;
  absences: number;
  missingPunches: number;
  other: number;
};

export type AttendanceReportEmployeeSummary = {
  employeeId: string;
  employeeName: string;
  /** Month days minus week-off and holiday (same for all employees). */
  workingDays: number;
  /** Days counted present (on time / late / regularized / manual / working today). */
  present: number;
  late: number;
  early: number;
  leave: number;
  absent: number;
  missingPunch: number;
  other: number;
};

const INDIA_TIME_ZONE = "Asia/Kolkata";

function indiaTimeParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: INDIA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value || 0);
  return { hour: get("hour"), minute: get("minute") };
}

export function minutesAfterMidnightIst(iso: string) {
  const parts = indiaTimeParts(iso);
  return parts.hour * 60 + parts.minute;
}

export function formatDurationMinutes(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) {
    return mins === 1 ? "1 minute" : `${mins} minutes`;
  }
  if (mins === 0) {
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  const hourLabel = hours === 1 ? "1 hour" : `${hours} hours`;
  const minLabel = mins === 1 ? "1 minute" : `${mins} minutes`;
  return `${hourLabel} ${minLabel}`;
}

export function formatClockTimeIst(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: INDIA_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function lateArrivalDetails(punchInAt: string) {
  const lateBy = minutesAfterMidnightIst(punchInAt) - OFFICE_START_MINUTES;
  return `${formatDurationMinutes(lateBy)} late`;
}

export function earlyDepartureDetails(
  punchOutAt: string,
  punchInAt?: string | null,
) {
  const outMinutes = minutesAfterMidnightIst(punchOutAt);
  const expectedEnd =
    punchInAt != null
      ? expectedOfficeEndMinutes(minutesAfterMidnightIst(punchInAt))
      : OFFICE_END_MINUTES;
  const earlyBy = expectedEnd - outMinutes;
  return `Left at ${formatClockTimeIst(punchOutAt)} · Early by ${formatDurationMinutes(earlyBy)}`;
}

export function onLeaveDetails(input: {
  leaveType: LeaveType;
  dayPortion: LeaveDayPortion;
  hasAttendance?: boolean;
}) {
  const base = leaveTypeLabel(input.leaveType);
  const portion =
    input.dayPortion && input.dayPortion !== "full"
      ? ` · ${leaveDayPortionLabel(input.dayPortion)}`
      : "";
  const conflict = input.hasAttendance
    ? " · Attendance recorded on leave date"
    : "";
  return `${base}${portion}${conflict}`;
}

export function isAttendanceReportAction(
  value: unknown,
): value is AttendanceReportAction {
  return (
    typeof value === "string" &&
    (ATTENDANCE_REPORT_ACTIONS as readonly string[]).includes(value)
  );
}

export function buildAutoKey(input: {
  date: string;
  employeeId: string;
  action: AttendanceReportAction;
}) {
  return `${input.date}|${input.employeeId}|${input.action}`;
}

function employeeDisplayName(employee: AttendanceReportEmployee) {
  return employee.displayName?.trim() || employee.email;
}

function leaveDatesInMonth(
  leave: AttendanceReportLeaveInput,
  monthFrom: string,
  monthEnd: string,
) {
  if (leave.status !== "approved") return [] as string[];
  const start = leave.startDate < monthFrom ? monthFrom : leave.startDate;
  const end = leave.endDate > monthEnd ? monthEnd : leave.endDate;
  if (start > end) return [];
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    const next = new Date(`${cursor}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    cursor = next.toISOString().slice(0, 10);
  }
  return dates;
}

/**
 * Generate automatic exception rows for a month.
 * Does not invent attendance/leave — only reads provided snapshots.
 */
export function generateAttendanceReportEntries(input: {
  monthKey: string;
  today: string;
  employees: AttendanceReportEmployee[];
  attendance: AttendanceReportAttendanceInput[];
  leaves: AttendanceReportLeaveInput[];
  holidays?: AttendanceReportHolidayInput[];
}): AttendanceReportAutoEntry[] {
  if (!isValidMonthKey(input.monthKey)) {
    throw new Error("Invalid month key.");
  }
  const { from, toExclusive } = monthRangeKeys(input.monthKey);
  const monthEnd = (() => {
    const end = new Date(`${toExclusive}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() - 1);
    return end.toISOString().slice(0, 10);
  })();

  const holidayByDate = new Map(
    (input.holidays ?? []).map((holiday) => [holiday.date, holiday]),
  );
  const attendanceByUserDate = new Map<string, AttendanceReportAttendanceInput>();
  for (const row of input.attendance) {
    attendanceByUserDate.set(`${row.userId}|${row.workDate}`, row);
  }

  const approvedLeaveByUserDate = new Map<
    string,
    AttendanceReportLeaveInput
  >();
  for (const leave of input.leaves) {
    for (const date of leaveDatesInMonth(leave, from, monthEnd)) {
      approvedLeaveByUserDate.set(`${leave.userId}|${date}`, leave);
    }
  }

  const entries: AttendanceReportAutoEntry[] = [];
  const seen = new Set<string>();

  function push(entry: AttendanceReportAutoEntry) {
    if (seen.has(entry.autoKey)) return;
    seen.add(entry.autoKey);
    entries.push(entry);
  }

  for (const employee of input.employees) {
    for (const date of eachDateKeyInMonth(input.monthKey)) {
      if (date > input.today) continue;

      const attendance =
        attendanceByUserDate.get(`${employee.id}|${date}`) ?? null;
      const leave = approvedLeaveByUserDate.get(`${employee.id}|${date}`);
      const holiday = holidayByDate.get(date);
      const isWeekOff = holiday?.kind === "weekoff";
      const isHoliday = holiday?.kind === "holiday";

      const status = getAttendanceDayStatus({
        date,
        today: input.today,
        attendance: attendance
          ? {
              punchInAt: attendance.punchInAt,
              punchOutAt: attendance.punchOutAt,
              classification: attendance.classification,
              punchInSource: attendance.punchInSource as
                | "employee"
                | "regularization"
                | "manual"
                | null
                | undefined,
              punchOutSource: attendance.punchOutSource as
                | "employee"
                | "regularization"
                | "manual"
                | null
                | undefined,
            }
          : null,
        isHoliday,
        isWeekOff,
      });

      if (status === "weekend" || status === "holiday" || status === "future") {
        continue;
      }

      const name = employeeDisplayName(employee);

      // Punch wins: if they worked the day, do not keep an On Leave exception.
      if (leave && !attendance?.punchInAt) {
        push({
          autoKey: buildAutoKey({
            date,
            employeeId: employee.id,
            action: "On Leave",
          }),
          date,
          employeeId: employee.id,
          employeeName: name,
          action: "On Leave",
          details: onLeaveDetails({
            leaveType: leave.leaveType,
            dayPortion: leave.dayPortion,
            hasAttendance: Boolean(
              attendance?.punchInAt || attendance?.punchOutAt,
            ),
          }),
          source: "leave",
        });
        continue;
      }

      if (status === "absent") {
        push({
          autoKey: buildAutoKey({
            date,
            employeeId: employee.id,
            action: "Absent",
          }),
          date,
          employeeId: employee.id,
          employeeName: name,
          action: "Absent",
          details: "Absent",
          source: "attendance",
        });
        continue;
      }

      if (status === "missing_punch_out") {
        push({
          autoKey: buildAutoKey({
            date,
            employeeId: employee.id,
            action: "Missing Punch",
          }),
          date,
          employeeId: employee.id,
          employeeName: name,
          action: "Missing Punch",
          details: "Punch Out missing",
          source: "attendance",
        });
      } else if (status === "missing_punch_in") {
        push({
          autoKey: buildAutoKey({
            date,
            employeeId: employee.id,
            action: "Missing Punch",
          }),
          date,
          employeeId: employee.id,
          employeeName: name,
          action: "Missing Punch",
          details: "Punch In missing",
          source: "attendance",
        });
      }

      if (attendance?.punchInAt) {
        const inMinutes = minutesAfterMidnightIst(attendance.punchInAt);
        if (classifyOfficePunchIn(inMinutes) === "late") {
          push({
            autoKey: buildAutoKey({
              date,
              employeeId: employee.id,
              action: "Arrived Late",
            }),
            date,
            employeeId: employee.id,
            employeeName: name,
            action: "Arrived Late",
            details: lateArrivalDetails(attendance.punchInAt),
            source: "attendance",
          });
        }
      }

      if (attendance?.punchOutAt) {
        const outMinutes = minutesAfterMidnightIst(attendance.punchOutAt);
        const inMinutes = attendance.punchInAt
          ? minutesAfterMidnightIst(attendance.punchInAt)
          : undefined;
        if (classifyOfficePunchOut(outMinutes, inMinutes) === "early") {
          push({
            autoKey: buildAutoKey({
              date,
              employeeId: employee.id,
              action: "Going Early",
            }),
            date,
            employeeId: employee.id,
            employeeName: name,
            action: "Going Early",
            details: earlyDepartureDetails(
              attendance.punchOutAt,
              attendance.punchInAt,
            ),
            source: "attendance",
          });
        }
      }
    }
  }

  entries.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    const byName = a.employeeName.localeCompare(b.employeeName);
    if (byName !== 0) return byName;
    return a.action.localeCompare(b.action);
  });

  return entries;
}

/** Merge auto-generated rows with persisted overlays (remarks, edits, manuals, deletes). */
export function mergeAttendanceReportEntries(input: {
  autoEntries: AttendanceReportAutoEntry[];
  overlays: AttendanceReportPersistedOverlay[];
  employees: AttendanceReportEmployee[];
}): AttendanceReportEntry[] {
  const employeeName = new Map(
    input.employees.map((employee) => [
      employee.id,
      employeeDisplayName(employee),
    ]),
  );
  const overlayByAutoKey = new Map<string, AttendanceReportPersistedOverlay>();
  const manuals: AttendanceReportPersistedOverlay[] = [];

  for (const overlay of input.overlays) {
    if (overlay.source === "manual" || !overlay.autoKey) {
      if (!overlay.deleted) manuals.push(overlay);
      continue;
    }
    overlayByAutoKey.set(overlay.autoKey, overlay);
  }

  const merged: AttendanceReportEntry[] = [];

  for (const auto of input.autoEntries) {
    const overlay = overlayByAutoKey.get(auto.autoKey);
    if (overlay?.deleted) continue;
    merged.push({
      id: overlay?.id ?? `auto:${auto.autoKey}`,
      autoKey: auto.autoKey,
      date: auto.date,
      employeeId: auto.employeeId,
      employeeName:
        overlay?.employeeName ||
        employeeName.get(auto.employeeId) ||
        auto.employeeName,
      action: overlay?.action ?? auto.action,
      details: overlay?.details ?? auto.details,
      managerRemark: overlay?.managerRemark ?? "",
      source: auto.source,
      isManual: false,
      isEditable: true,
    });
  }

  for (const manual of manuals) {
    merged.push({
      id: manual.id,
      autoKey: null,
      date: manual.date,
      employeeId: manual.employeeId,
      employeeName:
        manual.employeeName ||
        employeeName.get(manual.employeeId) ||
        "Unknown",
      action: manual.action,
      details: manual.details,
      managerRemark: manual.managerRemark ?? "",
      source: "manual",
      isManual: true,
      isEditable: true,
    });
  }

  merged.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    const byName = a.employeeName.localeCompare(b.employeeName);
    if (byName !== 0) return byName;
    return a.action.localeCompare(b.action);
  });

  return merged;
}

export function summarizeAttendanceReport(
  entries: AttendanceReportEntry[],
  totalEmployees: number,
): AttendanceReportSummary {
  const summary: AttendanceReportSummary = {
    totalEmployees,
    lateArrivals: 0,
    earlyDepartures: 0,
    leaves: 0,
    absences: 0,
    missingPunches: 0,
    other: 0,
  };
  for (const entry of entries) {
    if (entry.action === "Arrived Late") summary.lateArrivals += 1;
    else if (entry.action === "Going Early") summary.earlyDepartures += 1;
    else if (entry.action === "On Leave") summary.leaves += 1;
    else if (entry.action === "Absent") summary.absences += 1;
    else if (entry.action === "Missing Punch") summary.missingPunches += 1;
    else summary.other += 1;
  }
  return summary;
}

/** Calendar working days for a month: total days − week-off − holiday. */
export function countMonthWorkingDays(
  monthKey: string,
  holidays: AttendanceReportHolidayInput[] = [],
): number {
  const holidayByDate = new Map(
    holidays.map((holiday) => [holiday.date, holiday]),
  );
  let workingDays = 0;
  for (const date of eachDateKeyInMonth(monthKey)) {
    const holiday = holidayByDate.get(date);
    if (isIndiaWeekend(date) || holiday?.kind === "weekoff") continue;
    if (holiday?.kind === "holiday") continue;
    workingDays += 1;
  }
  return workingDays;
}

/**
 * Present days per employee through today — same rules as the self attendance ledger:
 * present / late / regularized / manual / working (or today with punch-in).
 * Approved leave, week-off, and holiday days are excluded.
 */
export function countPresentDaysByEmployee(input: {
  monthKey: string;
  today: string;
  employees: AttendanceReportEmployee[];
  attendance: AttendanceReportAttendanceInput[];
  leaves: AttendanceReportLeaveInput[];
  holidays?: AttendanceReportHolidayInput[];
}): Map<string, number> {
  const { from, toExclusive } = monthRangeKeys(input.monthKey);
  const monthEnd = (() => {
    const end = new Date(`${toExclusive}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() - 1);
    return end.toISOString().slice(0, 10);
  })();

  const holidayByDate = new Map(
    (input.holidays ?? []).map((holiday) => [holiday.date, holiday]),
  );
  const attendanceByUserDate = new Map<string, AttendanceReportAttendanceInput>();
  for (const row of input.attendance) {
    attendanceByUserDate.set(`${row.userId}|${row.workDate}`, row);
  }
  const approvedLeaveByUserDate = new Set<string>();
  for (const leave of input.leaves) {
    for (const date of leaveDatesInMonth(leave, from, monthEnd)) {
      approvedLeaveByUserDate.add(`${leave.userId}|${date}`);
    }
  }

  const presentByEmployeeId = new Map<string, number>();
  for (const employee of input.employees) {
    let present = 0;
    for (const date of eachDateKeyInMonth(input.monthKey)) {
      if (date > input.today) continue;
      const holiday = holidayByDate.get(date);
      const isWeekOff = holiday?.kind === "weekoff";
      const isHoliday = holiday?.kind === "holiday";
      if (isIndiaWeekend(date) || isWeekOff || isHoliday) continue;
      const attendance =
        attendanceByUserDate.get(`${employee.id}|${date}`) ?? null;
      // Leave without punch stays non-present; punch cancels leave coverage for the day.
      if (
        approvedLeaveByUserDate.has(`${employee.id}|${date}`) &&
        !attendance?.punchInAt
      ) {
        continue;
      }

      const status = getAttendanceDayStatus({
        date,
        today: input.today,
        attendance: attendance
          ? {
              punchInAt: attendance.punchInAt,
              punchOutAt: attendance.punchOutAt,
              classification: attendance.classification,
              punchInSource: attendance.punchInSource as
                | "employee"
                | "regularization"
                | "manual"
                | null
                | undefined,
              punchOutSource: attendance.punchOutSource as
                | "employee"
                | "regularization"
                | "manual"
                | null
                | undefined,
            }
          : null,
        isHoliday,
        isWeekOff,
      });

      if (
        status === "present" ||
        status === "late" ||
        status === "regularized" ||
        status === "manual" ||
        status === "working" ||
        (date === input.today && Boolean(attendance?.punchInAt))
      ) {
        present += 1;
      }
    }
    presentByEmployeeId.set(employee.id, present);
  }
  return presentByEmployeeId;
}

export function buildEmployeeSummaries(
  entries: AttendanceReportEntry[],
  employees: AttendanceReportEmployee[],
  workingDays = 0,
  presentByEmployeeId?: ReadonlyMap<string, number>,
): AttendanceReportEmployeeSummary[] {
  const byId = new Map<string, AttendanceReportEmployeeSummary>();
  for (const employee of employees) {
    byId.set(employee.id, {
      employeeId: employee.id,
      employeeName: employeeDisplayName(employee),
      workingDays,
      present: presentByEmployeeId?.get(employee.id) ?? 0,
      late: 0,
      early: 0,
      leave: 0,
      absent: 0,
      missingPunch: 0,
      other: 0,
    });
  }
  for (const entry of entries) {
    let row = byId.get(entry.employeeId);
    if (!row) {
      row = {
        employeeId: entry.employeeId,
        employeeName: entry.employeeName,
        workingDays,
        present: presentByEmployeeId?.get(entry.employeeId) ?? 0,
        late: 0,
        early: 0,
        leave: 0,
        absent: 0,
        missingPunch: 0,
        other: 0,
      };
      byId.set(entry.employeeId, row);
    }
    if (entry.action === "Arrived Late") row.late += 1;
    else if (entry.action === "Going Early") row.early += 1;
    else if (entry.action === "On Leave") row.leave += 1;
    else if (entry.action === "Absent") row.absent += 1;
    else if (entry.action === "Missing Punch") row.missingPunch += 1;
    else row.other += 1;
  }
  return [...byId.values()].sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName),
  );
}

export function validateManualReportEntry(input: {
  date: string;
  employeeId: string;
  action: unknown;
  details: string;
  managerRemark?: string;
  monthKey: string;
}) {
  if (!isValidMonthKey(input.monthKey)) throw new Error("Invalid month.");
  if (!isValidDateKey(input.date)) throw new Error("Invalid date.");
  if (!input.date.startsWith(input.monthKey)) {
    throw new Error("Date must fall within the selected month.");
  }
  if (!input.employeeId.trim()) throw new Error("Employee is required.");
  if (!isAttendanceReportAction(input.action)) {
    throw new Error("Invalid action.");
  }
  const details = input.details.trim();
  if (!details) throw new Error("Details are required.");
  if (details.length > 2000) {
    throw new Error("Details must be at most 2000 characters.");
  }
  const managerRemark = (input.managerRemark ?? "").trim();
  if (managerRemark.length > 2000) {
    throw new Error("Remark must be at most 2000 characters.");
  }
  return {
    date: input.date,
    employeeId: input.employeeId.trim(),
    action: input.action,
    details,
    managerRemark,
  };
}

export function reportMonthLabel(monthKey: string) {
  return formatMonthTitle(monthKey);
}

export function reportMonthRangeLabel(fromMonth: string, toMonth: string) {
  if (fromMonth === toMonth) return reportMonthLabel(fromMonth);
  return `${reportMonthLabel(fromMonth)} – ${reportMonthLabel(toMonth)}`;
}

/** Inclusive list of YYYY-MM keys from fromMonth through toMonth. */
export function eachMonthKeyInclusive(fromMonth: string, toMonth: string) {
  if (!isValidMonthKey(fromMonth) || !isValidMonthKey(toMonth)) {
    throw new Error("Invalid month.");
  }
  if (fromMonth > toMonth) {
    throw new Error("From month cannot be after to month.");
  }
  const months: string[] = [];
  let cursor = fromMonth;
  while (cursor <= toMonth) {
    months.push(cursor);
    cursor = shiftMonthKey(cursor, 1);
  }
  return months;
}

/** Validates from/to and returns the inclusive month list (no length cap). */
export function assertAttendanceReportMonthRange(
  fromMonth: string,
  toMonth: string,
) {
  return eachMonthKeyInclusive(fromMonth, toMonth);
}

export type AttendanceReportMonthSummaryRow = AttendanceReportEmployeeSummary & {
  month: string;
  monthLabel: string;
};

export type AttendanceReportMergeSlice = {
  month: string;
  monthLabel: string;
  summary: AttendanceReportSummary;
  employeeSummary: AttendanceReportEmployeeSummary[];
  entries: AttendanceReportEntry[];
  employees: AttendanceReportEmployee[];
};

export function filterAttendanceReportByEmployee<
  T extends {
    entries: AttendanceReportEntry[];
    employees: AttendanceReportEmployee[];
    employeeSummary: AttendanceReportEmployeeSummary[];
  },
>(slice: T, employeeId: string): T {
  const employees = slice.employees.filter((employee) => employee.id === employeeId);
  const entries = slice.entries.filter((entry) => entry.employeeId === employeeId);
  const employeeSummary = slice.employeeSummary.filter(
    (row) => row.employeeId === employeeId,
  );
  return {
    ...slice,
    employees,
    entries,
    employeeSummary,
  };
}

export function mergeAttendanceReportSlices(
  slices: AttendanceReportMergeSlice[],
  options?: { employeeId?: string | null },
) {
  if (!slices.length) {
    throw new Error("At least one month is required.");
  }
  const fromMonth = slices[0]!.month;
  const toMonth = slices[slices.length - 1]!.month;
  const employeeId = options?.employeeId?.trim() || null;

  const normalized = employeeId
    ? slices.map((slice) => filterAttendanceReportByEmployee(slice, employeeId))
    : slices;

  const employeeById = new Map<string, AttendanceReportEmployee>();
  for (const slice of normalized) {
    for (const employee of slice.employees) {
      if (!employeeById.has(employee.id)) employeeById.set(employee.id, employee);
    }
  }
  const employees = [...employeeById.values()].sort((a, b) => {
    const aName = a.displayName?.trim() || a.email;
    const bName = b.displayName?.trim() || b.email;
    return aName.localeCompare(bName);
  });

  const entries = normalized
    .flatMap((slice) => slice.entries)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const byName = a.employeeName.localeCompare(b.employeeName);
      if (byName !== 0) return byName;
      return a.action.localeCompare(b.action);
    });

  const summaryByEmployee = new Map<string, AttendanceReportEmployeeSummary>();
  for (const slice of normalized) {
    for (const row of slice.employeeSummary) {
      const existing = summaryByEmployee.get(row.employeeId);
      if (!existing) {
        summaryByEmployee.set(row.employeeId, { ...row });
        continue;
      }
      existing.workingDays += row.workingDays;
      existing.present += row.present;
      existing.late += row.late;
      existing.early += row.early;
      existing.leave += row.leave;
      existing.absent += row.absent;
      existing.missingPunch += row.missingPunch;
      existing.other += row.other;
    }
  }
  const employeeSummary = [...summaryByEmployee.values()].sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName),
  );

  const monthSummaries: AttendanceReportMonthSummaryRow[] | undefined =
    employeeId && normalized.length > 1
      ? normalized.flatMap((slice) =>
          slice.employeeSummary.map((row) => ({
            ...row,
            month: slice.month,
            monthLabel: slice.monthLabel,
          })),
        )
      : undefined;

  return {
    month: fromMonth,
    fromMonth,
    toMonth,
    monthLabel: reportMonthRangeLabel(fromMonth, toMonth),
    summary: summarizeAttendanceReport(entries, employees.length),
    employeeSummary,
    monthSummaries,
    entries,
    employees,
  };
}

export function excelFilenameForMonth(monthKey: string) {
  const label = formatMonthTitle(monthKey).replace(/\s+/g, "_");
  return `DevSync_Attendance_Report_${label}.xlsx`;
}

export function excelFilenameForReport(input: {
  fromMonth: string;
  toMonth: string;
  employeeName?: string | null;
}) {
  const range =
    input.fromMonth === input.toMonth
      ? formatMonthTitle(input.fromMonth).replace(/\s+/g, "_")
      : `${formatMonthTitle(input.fromMonth).replace(/\s+/g, "_")}_to_${formatMonthTitle(input.toMonth).replace(/\s+/g, "_")}`;
  const employee = input.employeeName?.trim()
    ? `_${input.employeeName.trim().replace(/\s+/g, "_")}`
    : "";
  return `DevSync_Attendance_Report_${range}${employee}.xlsx`;
}
