/** Pure aggregation helpers for the Admin Dashboard overview. */
import { addDaysToDateKey } from "@/lib/attendance-month";
import {
  isLeaveCoveringDate,
  leaveDayPortionLabel,
  leaveTypeLabel,
  rangesOverlap,
  type LeaveDayPortion,
  type LeaveStatus,
  type LeaveType,
} from "@/lib/leave-rules";
import {
  formatTaskDueLabel,
  isTaskPastDue,
  normalizeTaskPriority,
  taskPriorityLabel,
  type TaskPriority,
} from "@/lib/task-rules";

export const ADMIN_DASHBOARD_UPCOMING_DAYS = 7;

export type AdminDashboardLeaveSource = {
  id: string;
  userId: string;
  employeeName?: string;
  employeeEmail?: string;
  leaveType: LeaveType;
  dayPortion: LeaveDayPortion;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: LeaveStatus;
  reason?: string;
};

export type AdminDashboardLeaveRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: LeaveType;
  leaveTypeLabel: string;
  dayPortion: LeaveDayPortion;
  durationLabel: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: LeaveStatus;
  reason: string;
};

export type AdminDashboardSummary = {
  totalEmployees: number;
  presentToday: number;
  onLeaveToday: number;
  notPunchedIn: number;
};

export type AdminDashboardOverdueTaskSource = {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeEmail?: string;
  description: string;
  priority?: TaskPriority | string | null;
  dueDate?: string | null;
  dueTime?: string | null;
};

export type AdminDashboardOverdueTaskRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  description: string;
  priority: TaskPriority;
  priorityLabel: string;
  dueDate: string;
  dueTime: string | null;
  dueLabel: string;
};

function employeeDisplayName(leave: AdminDashboardLeaveSource) {
  return leave.employeeName || leave.employeeEmail || "Unknown employee";
}

export function toAdminDashboardLeaveRow(
  leave: AdminDashboardLeaveSource,
): AdminDashboardLeaveRow {
  return {
    id: leave.id,
    employeeId: leave.userId,
    employeeName: employeeDisplayName(leave),
    leaveType: leave.leaveType,
    leaveTypeLabel: leaveTypeLabel(leave.leaveType),
    dayPortion: leave.dayPortion,
    durationLabel: leaveDayPortionLabel(leave.dayPortion),
    startDate: leave.startDate,
    endDate: leave.endDate,
    totalDays: leave.totalDays,
    status: leave.status,
    reason: (leave.reason || "").trim(),
  };
}

/** Approved leave covering today (inclusive, working days only). */
export function filterOnLeaveToday(
  leaves: AdminDashboardLeaveSource[],
  today: string,
  holidayByDate?: Map<string, { kind: "holiday" | "weekoff"; name: string }>,
) {
  return leaves
    .filter(
      (leave) =>
        leave.status === "approved" &&
        isLeaveCoveringDate(leave, today, holidayByDate),
    )
    .map(toAdminDashboardLeaveRow);
}

/**
 * Approved leaves overlapping tomorrow through today+upcomingDays.
 * Pending/rejected never appear here.
 */
export function filterUpcomingApprovedLeaves(
  leaves: AdminDashboardLeaveSource[],
  today: string,
  upcomingDays = ADMIN_DASHBOARD_UPCOMING_DAYS,
) {
  const rangeStart = addDaysToDateKey(today, 1);
  const rangeEnd = addDaysToDateKey(today, upcomingDays);
  return leaves
    .filter(
      (leave) =>
        leave.status === "approved" &&
        rangesOverlap(leave.startDate, leave.endDate, rangeStart, rangeEnd),
    )
    .map(toAdminDashboardLeaveRow)
    .sort((a, b) =>
      a.startDate === b.startDate
        ? a.employeeName.localeCompare(b.employeeName)
        : a.startDate.localeCompare(b.startDate),
    );
}

export function filterPendingLeaveRequests(
  leaves: AdminDashboardLeaveSource[],
) {
  return leaves
    .filter((leave) => leave.status === "pending")
    .map(toAdminDashboardLeaveRow)
    .sort((a, b) =>
      a.startDate === b.startDate
        ? a.employeeName.localeCompare(b.employeeName)
        : a.startDate.localeCompare(b.startDate),
    );
}

/** Approved leaves overlapping an inclusive calendar window (for month grid). */
export function filterApprovedLeavesInRange(
  leaves: AdminDashboardLeaveSource[],
  rangeStart: string,
  rangeEnd: string,
) {
  return leaves
    .filter(
      (leave) =>
        leave.status === "approved" &&
        rangesOverlap(leave.startDate, leave.endDate, rangeStart, rangeEnd),
    )
    .map(toAdminDashboardLeaveRow);
}

export function leavesCoveringDate(
  leaves: AdminDashboardLeaveRow[],
  date: string,
  holidayByDate?: Map<string, { kind: "holiday" | "weekoff"; name: string }>,
) {
  return leaves.filter((leave) =>
    isLeaveCoveringDate(leave, date, holidayByDate),
  );
}

/**
 * Attendance summary with approved leave as an override:
 * on-leave employees are not counted as present or not-punched-in.
 * Present/punched counts are scoped to activeUserIds only.
 */
export function summarizeAdminAttendance(input: {
  activeUserIds: string[];
  punchedInUserIds: string[];
  onLeaveUserIds: string[];
}): AdminDashboardSummary {
  const active = new Set(input.activeUserIds);
  const onLeave = new Set(
    input.onLeaveUserIds.filter((userId) => active.has(userId)),
  );
  const present = new Set(
    input.punchedInUserIds.filter(
      (userId) => active.has(userId) && !onLeave.has(userId),
    ),
  );
  const notPunchedIn = input.activeUserIds.filter(
    (userId) => !present.has(userId) && !onLeave.has(userId),
  ).length;

  return {
    totalEmployees: input.activeUserIds.length,
    presentToday: present.size,
    onLeaveToday: onLeave.size,
    notPunchedIn,
  };
}

/** Pending assigned tasks whose due date/time has already passed. */
export function filterOverdueAssignedTasks(
  tasks: AdminDashboardOverdueTaskSource[],
  now: Date = new Date(),
): AdminDashboardOverdueTaskRow[] {
  return tasks
    .filter((task) =>
      isTaskPastDue({
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        now,
      }),
    )
    .map((task) => {
      const priority = normalizeTaskPriority(task.priority);
      const dueDate = task.dueDate as string;
      const dueTime = task.dueTime ?? null;
      return {
        id: task.id,
        employeeId: task.employeeId,
        employeeName:
          task.employeeName || task.employeeEmail || "Unknown employee",
        description: task.description.trim(),
        priority,
        priorityLabel: taskPriorityLabel(priority),
        dueDate,
        dueTime,
        dueLabel:
          formatTaskDueLabel({ dueDate, dueTime }) || dueDate,
      };
    })
    .sort((a, b) =>
      a.dueDate === b.dueDate
        ? a.dueTime === b.dueTime
          ? a.employeeName.localeCompare(b.employeeName)
          : (a.dueTime || "23:59").localeCompare(b.dueTime || "23:59")
        : a.dueDate.localeCompare(b.dueDate),
    );
}
