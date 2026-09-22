import type { Role, WorkspaceUser } from "@/types/common.types";

export type PunchOutSource = "employee" | "regularization" | "manual";
export type PunchInSource = PunchOutSource;
export type AttendanceCorrectionType =
  | "punch_out"
  | "punch_in"
  | "punch_in_and_out";

export type PunchOutAudit = {
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
};

export type PunchInAudit = PunchOutAudit;

export type AttendanceRecord = {
  id: string;
  userId: string;
  workDate: string;
  punchInAt?: string;
  punchOutAt?: string;
  classification: "on_time" | "late";
  state: "working" | "punched_out";
  device: { ipAddress: string | null; userAgent: string | null };
  punchInSource?: PunchInSource;
  punchInRecordedByUserId?: string | null;
  punchInRecordedByRole?: Role | null;
  punchInAudit?: PunchInAudit | null;
  punchOutSource?: PunchOutSource;
  punchOutRecordedByUserId?: string | null;
  punchOutRecordedByRole?: Role | null;
  punchOutAudit?: PunchOutAudit | null;
};

export type WorkUpdateTask = {
  id: string;
  description: string;
  minutes: number;
};

export type WorkUpdate = {
  id: string;
  userId: string;
  updateDate: string;
  tasks: WorkUpdateTask[];
  totalMinutes: number;
  blockers: string | null;
  submittedAt: string;
  updatedAt: string;
};

export type TaskRemark = {
  id: string;
  userName: string;
  text: string;
  createdAt: string;
};

export type AssignedTask = {
  id: string;
  developerUserId: string;
  assignedByUserId: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  dueTime: string | null;
  status: "pending" | "completed";
  assignedAt: string;
  completedAt: string | null;
  remarks: TaskRemark[];
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  type: string;
  resource?: {
    kind: "assigned_task" | "attendance_punch_out_request" | "leave_request";
    id: string;
  } | null;
  workDate?: string | null;
};

export type TeamMember = { user: WorkspaceUser; update: WorkUpdate | null };

export type EmployeeDetail = {
  employee: Pick<
    WorkspaceUser,
    "id" | "email" | "displayName" | "photoUrl" | "role" | "isActive"
  >;
  updates: Array<
    Pick<
      WorkUpdate,
      "id" | "updateDate" | "tasks" | "totalMinutes" | "blockers"
    >
  >;
  tasks: { pending: AssignedTask[]; completed: AssignedTask[] };
  summary: { totalUpdates: number; totalMinutes: number; pendingTasks: number };
};

export type SaveWorkUpdateInput = {
  updateDate: string;
  tasks: WorkUpdateTask[];
  blockers: string | null;
};

export type AssignTaskInput = {
  developerUserId: string;
  description: string;
  priority?: "low" | "medium" | "high" | "urgent";
  dueDate?: string | null;
  dueTime?: string | null;
};

export type PunchAction = "punch_in" | "punch_out";

export type PunchOutCorrectionRequest = {
  id: string;
  userId: string;
  attendanceId: string | null;
  workDate: string;
  correctionType: AttendanceCorrectionType;
  requestedPunchInAt: string | null;
  requestedPunchOutAt: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewedByUserId: string | null;
  reviewedByRole?: Role | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  employeeName?: string;
  employeeEmail?: string;
  punchInAt?: string;
  punchOutAt?: string;
};

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

export type LeaveType = "casual" | "sick" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type LeaveDayPortion =
  | "full"
  | "half"
  | "first_half"
  | "second_half"
  | "hours_1"
  | "hours_2"
  | "hours_3";

export type LeaveRequest = {
  id: string;
  userId: string;
  leaveType: LeaveType;
  dayPortion: LeaveDayPortion;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  /** Manager/Admin note when applying leave for an employee. */
  managerRemark?: string;
  status: LeaveStatus;
  appliedAt: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  employeeName?: string;
  employeeEmail?: string;
  reviewedByName?: string | null;
  reviewedByRole?: Role | null;
};

export type CreateLeaveRequestInput = {
  leaveType: LeaveType;
  dayPortion?: LeaveDayPortion;
  startDate: string;
  endDate: string;
  reason: string;
  /** Manager/Admin only — optional note when applying for an employee. */
  managerRemark?: string;
  /** Manager/Admin only — apply leave for another employee. */
  userId?: string;
  /** Manager/Admin only — create as pending or approved. */
  status?: "pending" | "approved";
};

export type RejectLeaveRequestInput = {
  rejectionReason: string;
};

export type LeaveStatusSummary = {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
};

export type CompanyHoliday = {
  id: string;
  date: string;
  name: string;
  kind: "holiday" | "weekoff";
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
};

export type CreateHolidayInput = {
  date: string;
  name: string;
  kind: "holiday" | "weekoff";
};

export type AdminDashboardSummary = {
  totalEmployees: number;
  presentToday: number;
  onLeaveToday: number;
  notPunchedIn: number;
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

export type AdminDashboardOverdueTaskRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  priorityLabel: string;
  dueDate: string;
  dueTime: string | null;
  dueLabel: string;
};

export type AdminDashboardPayload = {
  businessDate: string;
  monthKey: string;
  summary: AdminDashboardSummary;
  onLeaveToday: AdminDashboardLeaveRow[];
  upcomingLeaves: AdminDashboardLeaveRow[];
  pendingLeaveRequests: AdminDashboardLeaveRow[];
  calendarLeaves: AdminDashboardLeaveRow[];
  calendarHolidays: Array<{
    id: string;
    date: string;
    name: string;
    kind: "holiday" | "weekoff";
  }>;
  overdueTasks: AdminDashboardOverdueTaskRow[];
};

export type AttendanceDay = {
  date: string;
  dayOfMonth: number;
  status: AttendanceDayStatus;
  attendance: AttendanceRecord | null;
  punchInAt: string | null;
  punchOutAt: string | null;
  totalHours: number | null;
  punchOutSource: PunchOutSource | null;
  correctionRequest: {
    id: string;
    status: "pending" | "approved" | "rejected";
    correctionType?: AttendanceCorrectionType;
    requestedPunchInAt: string | null;
    requestedPunchOutAt: string | null;
    reason: string | null;
    reviewedAt: string | null;
    reviewNote?: string | null;
    reviewedByRole?: Role | null;
  } | null;
  leaveInfo?: {
    id: string;
    status: "approved" | "rejected";
    dayPortion: LeaveDayPortion;
    leaveType: LeaveType;
    reason?: string | null;
    rejectionReason: string | null;
  } | null;
  holidayInfo?: {
    id: string;
    name: string;
    kind: "holiday" | "weekoff";
  } | null;
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

export type CreatePunchOutCorrectionRequestInput = {
  workDate: string;
  correctionType?: AttendanceCorrectionType;
  requestedPunchInAt?: string | null;
  requestedPunchOutAt?: string | null;
  reason: string;
};

export type RejectPunchOutCorrectionInput = {
  reviewNote: string;
};

export type ManualPunchOutInput = {
  userId: string;
  workDate: string;
  punchOutAt: string;
  reason: string;
};

export type AttendanceReportAction =
  | "Arrived Late"
  | "Going Early"
  | "On Leave"
  | "Absent"
  | "Missing Punch"
  | "Other";

export type AttendanceReportSource = "attendance" | "leave" | "manual";

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
  workingDays: number;
  present: number;
  late: number;
  early: number;
  leave: number;
  absent: number;
  missingPunch: number;
  other: number;
};

export type AttendanceReportPayload = {
  month: string;
  monthLabel: string;
  /** Inclusive range start (YYYY-MM). Same as month when single-month. */
  fromMonth?: string;
  /** Inclusive range end (YYYY-MM). Same as month when single-month. */
  toMonth?: string;
  generatedAt: string;
  manager: {
    id: string;
    displayName: string | null;
    email: string;
  };
  summary: AttendanceReportSummary;
  employeeSummary: AttendanceReportEmployeeSummary[];
  /** Per-month rows when a multi-month report focuses on one employee. */
  monthSummaries?: Array<
    AttendanceReportEmployeeSummary & {
      month: string;
      monthLabel: string;
    }
  >;
  entries: AttendanceReportEntry[];
  employees: Array<{
    id: string;
    displayName: string | null;
    email: string;
  }>;
};

export type CreateAttendanceReportEntryInput = {
  month: string;
  date: string;
  employeeId: string;
  action: AttendanceReportAction;
  details: string;
  managerRemark?: string;
};

export type UpdateAttendanceReportEntryInput = {
  month: string;
  id: string;
  action?: AttendanceReportAction;
  details?: string;
  managerRemark?: string;
};

export type { Role, WorkspaceUser };
