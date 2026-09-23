/**
 * MongoDB operational repository for DevSync v2. This module owns the persistent
 * attendance, daily-update, assigned-task, remark, notification, and audit workflows.
 */
import "server-only";
import { ObjectId, type WithId } from "mongodb";
import { getMongoDatabase } from "@/lib/mongodb";
import { serverNow } from "@/lib/server-clock";
import {
  assertWorkUpdateSubmittedBeforePunchOut,
  classifyOfficePunchIn,
  isPermittedWorkUpdateDate,
  requiresWorkUpdateBeforePunchOut,
  sumTaskMinutes,
} from "@/lib/operation-rules";
import {
  addDaysToDateKey,
  buildAttendanceMonth,
  isValidMonthKey,
  monthRangeKeys,
  nextDateKey,
  toIndiaMonthKey,
  type AttendanceDayCorrection,
  type AttendanceDayHolidayInfo,
  type AttendanceDayLeaveInfo,
  type AttendanceDayRecord,
  type AttendanceMonthLedger,
} from "@/lib/attendance-month";
import {
  ADMIN_DASHBOARD_UPCOMING_DAYS,
  filterApprovedLeavesInRange,
  filterOnLeaveToday,
  filterOverdueAssignedTasks,
  filterPendingLeaveRequests,
  filterUpcomingApprovedLeaves,
  summarizeAdminAttendance,
} from "@/lib/admin-dashboard-rules";
import {
  assertHolidayDateValid,
  canManageHolidays,
  holidayKindLabel,
  normalizeHolidayKind,
  validateHolidayName,
  type HolidayKind,
} from "@/lib/holiday-rules";
import {
  assertAttendanceReportMonthRange,
  buildEmployeeSummaries,
  countMonthWorkingDays,
  countPresentDaysByEmployee,
  generateAttendanceReportEntries,
  isAttendanceReportAction,
  mergeAttendanceReportEntries,
  mergeAttendanceReportSlices,
  reportMonthLabel,
  summarizeAttendanceReport,
  validateManualReportEntry,
  type AttendanceReportPersistedOverlay,
} from "@/lib/attendance-report-rules";
import { scheduleNotificationEmail } from "@/lib/email/notification-mail";
import { scheduleNotificationPush } from "@/lib/push/notification-push";
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
  type AttendanceCorrectionType,
} from "@/lib/punch-out-correction-rules";
import {
  buildPunchInAudit,
  buildPunchOutAudit,
  employeePunchOutFields,
  type PunchInAudit,
  type PunchInSource,
  type PunchOutAudit,
  type PunchOutSource,
  resolvePunchInSource,
  resolvePunchOutSource,
} from "@/lib/punch-out-audit";
import { type Role } from "@/lib/roles";
import { isAttendanceTrackedRole } from "@/lib/auth/permissions";
import { getUserById, listUsers, type DevSyncUser } from "@/lib/users";
import {
  assertLeaveCanBeRejected,
  assertLeaveDateRangeValid,
  buildLeaveStatusSummary,
  canManageLeaveRequests,
  eachDateKeyInclusive,
  formatLeaveDateRangeLabel,
  isLeaveCoveringDate,
  isLeaveNonWorkingDate,
  isLeaveType,
  LEAVE_CANCELLED_ON_PUNCH_REASON,
  normalizeLeaveDayPortion,
  planFullDayLeaveCancelForPunchDate,
  rangesOverlap,
  validateLeaveManagerRemark,
  validateLeaveReason,
  validateRejectionReason,
  type LeaveDayPortion,
  type LeaveStatus,
  type LeaveType,
} from "@/lib/leave-rules";
import {
  assertTaskDueInput,
  buildTaskAssignedNotificationBody,
  formatTaskDueLabel,
  isTaskPastDue,
  normalizeTaskPriority,
  TASK_OVERDUE_NOTIFICATION_TYPE,
  taskPriorityLabel,
} from "@/lib/task-rules";

const INDIA_TIME_ZONE = "Asia/Kolkata";

export type AttendanceClassification = "on_time" | "late";
export type AttendanceState = "working" | "punched_out";
export type AssignedTaskStatus = "pending" | "completed";

export type TaskEntry = { id: string; description: string; minutes: number };
export type TaskRemark = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: Date;
};

type AttendanceDocument = {
  userId: ObjectId;
  workDate: string;
  punchInAt?: Date;
  punchOutAt?: Date;
  classification: AttendanceClassification;
  state: AttendanceState;
  device: { ipAddress: string | null; userAgent: string | null };
  punchInSource?: PunchInSource;
  punchInRecordedByUserId?: ObjectId | null;
  punchInRecordedByRole?: Role | null;
  punchOutSource?: PunchOutSource;
  punchOutRecordedByUserId?: ObjectId | null;
  punchOutRecordedByRole?: Role | null;
  createdAt: Date;
  updatedAt: Date;
};

type WorkUpdateDocument = {
  userId: ObjectId;
  updateDate: string;
  tasks: TaskEntry[];
  totalMinutes: number;
  blockers: string | null;
  submittedAt: Date;
  updatedAt: Date;
};

type AssignedTaskDocument = {
  developerUserId: ObjectId;
  assignedByUserId: ObjectId;
  description: string;
  priority?: "low" | "medium" | "high" | "urgent";
  dueDate?: string | null;
  dueTime?: string | null;
  status: AssignedTaskStatus;
  assignedAt: Date;
  completedAt: Date | null;
  remarks: TaskRemark[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  deletedByUserId?: ObjectId;
  /** Set when assigner was notified that this pending task is overdue. */
  overdueNotifiedAt?: Date | null;
};

type NotificationDocument = {
  recipientUserId: ObjectId;
  type:
    | "task_assigned"
    | "task_completed"
    | "role_changed"
    | "punch_out_correction_requested"
    | "punch_out_correction_approved"
    | "punch_out_correction_rejected"
    | "punch_out_manual"
    | "punch_in_correction_requested"
    | "punch_in_correction_approved"
    | "punch_in_correction_rejected"
    | "work_update_reminder"
    | "leave_requested"
    | "leave_approved"
    | "leave_rejected"
    | "task_overdue";
  title: string;
  body: string;
  resource:
    | { kind: "assigned_task"; id: ObjectId }
    | { kind: "attendance_punch_out_request"; id: ObjectId }
    | { kind: "leave_request"; id: ObjectId }
    | null;
  /** Optional business-date key for idempotent reminder notifications. */
  workDate?: string;
  isRead: boolean;
  createdAt: Date;
  readAt: Date | null;
};

export type PunchOutRequestStatus = "pending" | "approved" | "rejected";

type AttendancePunchOutRequestDocument = {
  userId: ObjectId;
  attendanceId: ObjectId | null;
  workDate: string;
  correctionType: AttendanceCorrectionType;
  requestedPunchInAt: Date | null;
  requestedPunchOutAt: Date | null;
  reason: string;
  status: PunchOutRequestStatus;
  reviewedByUserId: ObjectId | null;
  /** Role snapshot of the Manager/Admin who reviewed the request. */
  reviewedByRole?: Role | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type LeaveRequestDocument = {
  userId: ObjectId;
  leaveType: LeaveType;
  dayPortion: LeaveDayPortion;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  managerRemark?: string;
  status: LeaveStatus;
  appliedAt: Date;
  reviewedByUserId: ObjectId | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CompanyHolidayDocument = {
  date: string;
  name: string;
  kind?: "holiday" | "weekoff";
  createdByUserId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

type AttendanceReportEntryDocument = {
  monthKey: string;
  managerId: ObjectId;
  employeeId: ObjectId;
  date: string;
  action: string;
  details: string;
  managerRemark: string;
  source: "attendance" | "leave" | "manual";
  autoKey: string | null;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type LeaveRequest = {
  id: string;
  userId: string;
  leaveType: LeaveType;
  dayPortion: LeaveDayPortion;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
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

export type AttendanceRecord = Omit<
  AttendanceDocument,
  "userId" | "punchOutRecordedByUserId" | "punchInRecordedByUserId"
> & {
  id: string;
  userId: string;
  punchOutRecordedByUserId?: string | null;
  punchInRecordedByUserId?: string | null;
  punchOutAudit?: PunchOutAudit | null;
  punchInAudit?: PunchInAudit | null;
};
export type WorkUpdate = Omit<WorkUpdateDocument, "userId"> & {
  id: string;
  userId: string;
};
export type AssignedTask = Omit<
  AssignedTaskDocument,
  "developerUserId" | "assignedByUserId"
> & { id: string; developerUserId: string; assignedByUserId: string };
export type Notification = Omit<
  NotificationDocument,
  "recipientUserId" | "resource"
> & {
  id: string;
  recipientUserId: string;
  resource:
    | { kind: "assigned_task"; id: string }
    | { kind: "attendance_punch_out_request"; id: string }
    | { kind: "leave_request"; id: string }
    | null;
};

export type AttendancePunchOutRequest = {
  id: string;
  userId: string;
  attendanceId: string | null;
  workDate: string;
  correctionType: AttendanceCorrectionType;
  requestedPunchInAt: string | null;
  requestedPunchOutAt: string | null;
  reason: string;
  status: PunchOutRequestStatus;
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

let indexesPromise: Promise<void> | undefined;

async function ensureOperationIndexes() {
  if (!indexesPromise) {
    indexesPromise = (async () => {
      const database = await getMongoDatabase();
      const requests = database.collection<AttendancePunchOutRequestDocument>(
        "attendancePunchOutRequests",
      );
      // Additive backfill so legacy punch-out requests keep working under the new unique key.
      await requests.updateMany(
        { correctionType: { $exists: false } },
        {
          $set: {
            correctionType: "punch_out",
            requestedPunchInAt: null,
          },
        },
      );
      await requests.updateMany(
        { requestedPunchInAt: { $exists: false } },
        { $set: { requestedPunchInAt: null } },
      );
      try {
        await requests.dropIndex("unique_punch_out_request_per_attendance");
      } catch {
        // Index may not exist on fresh environments.
      }
      try {
        await requests.dropIndex("unique_correction_per_user_date_type");
      } catch {
        // Replaced by pending-only partial unique index below.
      }
      await Promise.all([
        database
          .collection<AttendanceDocument>("attendance")
          .createIndex({ userId: 1, workDate: 1 }, { unique: true }),
        database
          .collection<AttendanceDocument>("attendance")
          .createIndex({ workDate: 1, punchInAt: 1 }),
        database
          .collection<WorkUpdateDocument>("workUpdates")
          .createIndex({ userId: 1, updateDate: 1 }, { unique: true }),
        database
          .collection<WorkUpdateDocument>("workUpdates")
          .createIndex({ updateDate: 1, submittedAt: -1 }),
        database
          .collection<AssignedTaskDocument>("assignedTasks")
          .createIndex({ developerUserId: 1, status: 1, assignedAt: -1 }),
        database
          .collection<AssignedTaskDocument>("assignedTasks")
          .createIndex(
            { status: 1, dueDate: 1, overdueNotifiedAt: 1 },
            { name: "assigned_tasks_overdue_scan" },
          ),
        database
          .collection<NotificationDocument>("notifications")
          .createIndex({ recipientUserId: 1, isRead: 1, createdAt: -1 }),
        requests.createIndex(
          { userId: 1, workDate: 1, correctionType: 1 },
          {
            unique: true,
            name: "unique_pending_correction_per_user_date_type",
            partialFilterExpression: { status: "pending" },
          },
        ),
        requests.createIndex(
          { status: 1, workDate: -1 },
          { name: "punch_out_requests_status_date" },
        ),
        requests.createIndex(
          { userId: 1, workDate: -1 },
          { name: "punch_out_requests_user_date" },
        ),
        database.collection<LeaveRequestDocument>("leaveRequests").createIndex(
          { userId: 1, startDate: 1, endDate: 1 },
          { name: "leave_requests_user_dates" },
        ),
        database.collection<LeaveRequestDocument>("leaveRequests").createIndex(
          { status: 1, appliedAt: -1 },
          { name: "leave_requests_status_applied" },
        ),
        database.collection<LeaveRequestDocument>("leaveRequests").createIndex(
          { userId: 1, status: 1, appliedAt: -1 },
          { name: "leave_requests_user_status" },
        ),
        database.collection<CompanyHolidayDocument>("companyHolidays").createIndex(
          { date: 1 },
          { unique: true, name: "unique_company_holiday_date" },
        ),
        database.collection<CompanyHolidayDocument>("companyHolidays").createIndex(
          { date: -1 },
          { name: "company_holidays_date_desc" },
        ),
        database
          .collection("attendanceReportEntries")
          .createIndex(
            { monthKey: 1, managerId: 1 },
            { name: "attendance_report_entries_month_manager" },
          ),
        database
          .collection("attendanceReportEntries")
          .createIndex(
            { monthKey: 1, managerId: 1, autoKey: 1 },
            {
              unique: true,
              sparse: true,
              name: "unique_attendance_report_auto_key",
            },
          ),
      ]);
    })();
  }
  await indexesPromise;
}

function objectId(value: string, label: string) {
  if (!ObjectId.isValid(value)) throw new Error(`Invalid ${label}.`);
  return new ObjectId(value);
}

function mapAttendance(document: WithId<AttendanceDocument>): AttendanceRecord {
  return {
    ...document,
    id: document._id.toHexString(),
    userId: document.userId.toHexString(),
    punchOutRecordedByUserId: document.punchOutRecordedByUserId
      ? document.punchOutRecordedByUserId.toHexString()
      : document.punchOutRecordedByUserId === null
        ? null
        : undefined,
    punchInRecordedByUserId: document.punchInRecordedByUserId
      ? document.punchInRecordedByUserId.toHexString()
      : document.punchInRecordedByUserId === null
        ? null
        : undefined,
  };
}

async function attachPunchOutAudits(
  records: AttendanceRecord[],
): Promise<AttendanceRecord[]> {
  if (!records.length) return records;
  const database = await getMongoDatabase();
  const users = await listUsers();
  const usersById = new Map(users.map((user) => [user.id, user]));

  const managedIds = records
    .filter((record) => {
      const out = resolvePunchOutSource(record);
      const inn = resolvePunchInSource(record);
      return (
        out === "regularization" ||
        out === "manual" ||
        inn === "regularization" ||
        inn === "manual"
      );
    })
    .map((record) => objectId(record.id, "attendance ID"));

  const approvedRequests = managedIds.length
    ? await database
        .collection<AttendancePunchOutRequestDocument>("attendancePunchOutRequests")
        .find({
          attendanceId: { $in: managedIds },
          status: "approved",
        })
        .toArray()
    : [];
  const requestsByAttendanceId = new Map<
    string,
    WithId<AttendancePunchOutRequestDocument>[]
  >();
  for (const document of approvedRequests) {
    if (!document.attendanceId) continue;
    const key = document.attendanceId.toHexString();
    const list = requestsByAttendanceId.get(key) ?? [];
    list.push(document);
    requestsByAttendanceId.set(key, list);
  }

  const manualAttendanceIds = records
    .filter((record) => resolvePunchOutSource(record) === "manual")
    .map((record) => record.id);
  const manualAudits = manualAttendanceIds.length
    ? await database
        .collection("auditEvents")
        .find({
          action: "attendance.punch_out_manual",
          "metadata.attendanceId": { $in: manualAttendanceIds },
        })
        .sort({ createdAt: -1 })
        .toArray()
    : [];
  const manualByAttendanceId = new Map<
    string,
    { reason: string | null; createdAt: Date | null }
  >();
  for (const event of manualAudits) {
    const attendanceId =
      event &&
      typeof event === "object" &&
      event.metadata &&
      typeof event.metadata === "object" &&
      "attendanceId" in event.metadata
        ? String((event.metadata as { attendanceId?: unknown }).attendanceId)
        : null;
    if (!attendanceId || manualByAttendanceId.has(attendanceId)) continue;
    const reason =
      event.metadata &&
      typeof event.metadata === "object" &&
      "reason" in event.metadata
        ? String((event.metadata as { reason?: unknown }).reason ?? "")
        : null;
    manualByAttendanceId.set(attendanceId, {
      reason: reason || null,
      createdAt: event.createdAt instanceof Date ? event.createdAt : null,
    });
  }

  return records.map((record) => {
    const outSource = resolvePunchOutSource(record);
    const inSource = resolvePunchInSource(record);
    const requests = requestsByAttendanceId.get(record.id) ?? [];
    const outRequest =
      requests.find((item) => {
        const type = normalizeCorrectionType(item.correctionType);
        return type === "punch_out" || type === "punch_in_and_out";
      }) ?? requests[0];
    const inRequest =
      requests.find((item) => {
        const type = normalizeCorrectionType(item.correctionType);
        return type === "punch_in" || type === "punch_in_and_out";
      }) ?? requests[0];
    const manual = manualByAttendanceId.get(record.id);

    let punchOutAudit: PunchOutAudit | null = null;
    if (outSource) {
      const actorUser = record.punchOutRecordedByUserId
        ? usersById.get(record.punchOutRecordedByUserId)
        : null;
      let reason: string | null = null;
      let recordedAt: string | null = null;
      let requestStatus: "approved" | null = null;
      let requestedAt: string | null = null;

      if (outSource === "regularization" && outRequest) {
        reason = outRequest.reason;
        recordedAt = outRequest.reviewedAt
          ? outRequest.reviewedAt.toISOString()
          : record.updatedAt instanceof Date
            ? record.updatedAt.toISOString()
            : String(record.updatedAt);
        requestStatus = outRequest.status === "approved" ? "approved" : null;
        requestedAt = outRequest.createdAt.toISOString();
      } else if (outSource === "manual") {
        reason = manual?.reason ?? null;
        recordedAt =
          manual?.createdAt?.toISOString() ??
          (record.updatedAt instanceof Date
            ? record.updatedAt.toISOString()
            : String(record.updatedAt));
      } else if (record.punchOutAt) {
        recordedAt =
          record.punchOutAt instanceof Date
            ? record.punchOutAt.toISOString()
            : String(record.punchOutAt);
      }

      punchOutAudit = buildPunchOutAudit({
        punchOutAt: record.punchOutAt,
        punchOutSource: outSource,
        punchOutRecordedByUserId: record.punchOutRecordedByUserId,
        punchOutRecordedByRole: record.punchOutRecordedByRole,
        recordedAt,
        reason,
        requestStatus,
        requestedAt,
        actor: actorUser
          ? {
              id: actorUser.id,
              displayName: actorUser.displayName,
              email: actorUser.email,
              role: actorUser.role,
            }
          : null,
      });
    }

    let punchInAudit: PunchInAudit | null = null;
    if (inSource) {
      const actorUser = record.punchInRecordedByUserId
        ? usersById.get(record.punchInRecordedByUserId)
        : null;
      let reason: string | null = null;
      let recordedAt: string | null = null;
      let requestStatus: "approved" | null = null;
      let requestedAt: string | null = null;

      if (inSource === "regularization" && inRequest) {
        reason = inRequest.reason;
        recordedAt = inRequest.reviewedAt
          ? inRequest.reviewedAt.toISOString()
          : record.updatedAt instanceof Date
            ? record.updatedAt.toISOString()
            : String(record.updatedAt);
        requestStatus = inRequest.status === "approved" ? "approved" : null;
        requestedAt = inRequest.createdAt.toISOString();
      } else if (record.punchInAt) {
        recordedAt =
          record.punchInAt instanceof Date
            ? record.punchInAt.toISOString()
            : String(record.punchInAt);
      }

      punchInAudit = buildPunchInAudit({
        punchInAt: record.punchInAt,
        punchInSource: inSource,
        punchInRecordedByUserId: record.punchInRecordedByUserId,
        punchInRecordedByRole: record.punchInRecordedByRole,
        recordedAt,
        reason,
        requestStatus,
        requestedAt,
        actor: actorUser
          ? {
              id: actorUser.id,
              displayName: actorUser.displayName,
              email: actorUser.email,
              role: actorUser.role,
            }
          : null,
      });
    }

    return {
      ...record,
      punchOutSource: outSource ?? record.punchOutSource,
      punchInSource: inSource ?? record.punchInSource,
      punchOutAudit,
      punchInAudit,
    };
  });
}

export async function getAttendanceWithAudit(userId: string, workDate: string) {
  const attendance = await getAttendanceForUserDate(userId, workDate);
  if (!attendance) return null;
  const [enriched] = await attachPunchOutAudits([attendance]);
  return enriched;
}

export type TeamAttendanceActivityFilter = "all" | "active" | "inactive";

export async function listTeamAttendanceRows(
  workDate: string,
  activity: TeamAttendanceActivityFilter = "active",
) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const [users, attendance, leaveDocuments, holidayByDate] = await Promise.all([
    listUsers(),
    listAttendance({ workDate }),
    database
      .collection<LeaveRequestDocument>("leaveRequests")
      .find({
        status: "approved",
        startDate: { $lte: workDate },
        endDate: { $gte: workDate },
      })
      .project({
        userId: 1,
        startDate: 1,
        endDate: 1,
        leaveType: 1,
        dayPortion: 1,
        reason: 1,
      })
      .toArray(),
    listHolidayInfoByDate(workDate, nextDateKey(workDate)),
  ]);
  const enriched = await attachPunchOutAudits(attendance);
  const byUserId = new Map(enriched.map((record) => [record.userId, record]));
  const leaveByUserId = new Map<
    string,
    {
      leaveType: LeaveType;
      dayPortion: LeaveDayPortion;
      reason: string;
    }
  >();
  for (const document of leaveDocuments) {
    if (
      !isLeaveCoveringDate(
        { startDate: document.startDate, endDate: document.endDate },
        workDate,
        holidayByDate,
      )
    ) {
      continue;
    }
    const userId = document.userId.toHexString();
    if (leaveByUserId.has(userId)) continue;
    leaveByUserId.set(userId, {
      leaveType: document.leaveType,
      dayPortion: normalizeLeaveDayPortion(document.dayPortion),
      reason: (document.reason || "").trim(),
    });
  }
  return users
    .filter((user) => {
      if (!isAttendanceTrackedRole(user.role)) return false;
      if (activity === "active") return user.isActive;
      if (activity === "inactive") return !user.isActive;
      return true;
    })
    .map((user) => {
      const attendance = byUserId.get(user.id) || null;
      const leave = leaveByUserId.get(user.id) ?? null;
      return {
        user,
        attendance,
        // Count On Leave only when they have leave and have not punched in yet
        // (half-day / hourly with punch-in counts as Present; leave still shown in table).
        onLeave: Boolean(leave) && !attendance?.punchInAt,
        leave,
      };
    });
}

function mapUpdate(document: WithId<WorkUpdateDocument>): WorkUpdate {
  return {
    ...document,
    id: document._id.toHexString(),
    userId: document.userId.toHexString(),
  };
}

function mapTask(document: WithId<AssignedTaskDocument>): AssignedTask {
  const { overdueNotifiedAt: _overdueNotifiedAt, ...rest } = document;
  return {
    ...rest,
    id: document._id.toHexString(),
    developerUserId: document.developerUserId.toHexString(),
    assignedByUserId: document.assignedByUserId.toHexString(),
    priority: normalizeTaskPriority(document.priority),
    dueDate: document.dueDate ?? null,
    dueTime: document.dueTime ?? null,
  };
}

function mapNotification(document: WithId<NotificationDocument>): Notification {
  return {
    ...document,
    id: document._id.toHexString(),
    recipientUserId: document.recipientUserId.toHexString(),
    resource: document.resource
      ? { kind: document.resource.kind, id: document.resource.id.toHexString() }
      : null,
  };
}

/** Persist an in-app notification and optionally email + browser-push the recipient. */
function queueNotificationEmail(input: {
  recipientUserId: ObjectId | string;
  type: NotificationDocument["type"];
  title: string;
  body: string;
  recipientEmail?: string | null;
}) {
  const recipientUserId =
    typeof input.recipientUserId === "string"
      ? input.recipientUserId
      : input.recipientUserId.toHexString();
  const payload = {
    recipientUserId,
    type: input.type,
    title: input.title,
    body: input.body,
    recipientEmail: input.recipientEmail,
  };
  scheduleNotificationEmail(payload);
  scheduleNotificationPush(payload);
}

function mapPunchOutRequest(
  document: WithId<AttendancePunchOutRequestDocument>,
): AttendancePunchOutRequest {
  return {
    id: document._id.toHexString(),
    userId: document.userId.toHexString(),
    attendanceId: document.attendanceId
      ? document.attendanceId.toHexString()
      : null,
    workDate: document.workDate,
    correctionType: normalizeCorrectionType(document.correctionType),
    requestedPunchInAt: document.requestedPunchInAt
      ? document.requestedPunchInAt.toISOString()
      : null,
    requestedPunchOutAt: document.requestedPunchOutAt
      ? document.requestedPunchOutAt.toISOString()
      : null,
    reason: document.reason,
    status: document.status,
    reviewedByUserId: document.reviewedByUserId
      ? document.reviewedByUserId.toHexString()
      : null,
    reviewedByRole: document.reviewedByRole ?? null,
    reviewedAt: document.reviewedAt ? document.reviewedAt.toISOString() : null,
    reviewNote: document.reviewNote,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function partsInIndia(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(part => part.type === type)?.value || 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
  };
}

export function indiaDateKey(date = new Date()) {
  const parts = partsInIndia(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function previousIndiaDateKey(date = new Date()) {
  const parts = partsInIndia(date);
  const utcEquivalent = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day - 1)
  );
  return `${utcEquivalent.getUTCFullYear()}-${String(utcEquivalent.getUTCMonth() + 1).padStart(2, "0")}-${String(utcEquivalent.getUTCDate()).padStart(2, "0")}`;
}

export function classifyPunchIn(
  timestamp = new Date()
): AttendanceClassification {
  const parts = partsInIndia(timestamp);
  return classifyOfficePunchIn(parts.hour * 60 + parts.minute);
}

export function canSubmitUpdateForDate(workDate: string, now = new Date()) {
  return isPermittedWorkUpdateDate(
    workDate,
    indiaDateKey(now),
    previousIndiaDateKey(now)
  );
}

export function canViewTeamData(user: DevSyncUser) {
  return user.role === "admin" || user.role === "manager";
}

function assertAttendanceTracked(user: DevSyncUser, action: string) {
  if (!isAttendanceTrackedRole(user.role)) {
    throw new Error(`Admin accounts do not ${action}.`);
  }
}

/**
 * If the employee punches in on a pending/approved full-day leave date,
 * reject that leave so employee and manager leave tables both show Rejected.
 */
async function cancelFullDayLeaveCoveringPunchDate(input: {
  user: DevSyncUser;
  workDate: string;
  now: Date;
}) {
  const database = await getMongoDatabase();
  const requests = database.collection<LeaveRequestDocument>("leaveRequests");
  const userId = objectId(input.user.id, "user ID");
  const covering = await requests
    .find({
      userId,
      status: { $in: ["pending", "approved"] },
      startDate: { $lte: input.workDate },
      endDate: { $gte: input.workDate },
    })
    .toArray();
  if (!covering.length) return;

  const holidayByDate = await listHolidayInfoByDate(
    covering.reduce(
      (min, doc) => (doc.startDate < min ? doc.startDate : min),
      input.workDate,
    ),
    nextDateKey(
      covering.reduce(
        (max, doc) => (doc.endDate > max ? doc.endDate : max),
        input.workDate,
      ),
    ),
  );

  for (const document of covering) {
    const plan = planFullDayLeaveCancelForPunchDate({
      startDate: document.startDate,
      endDate: document.endDate,
      dayPortion: normalizeLeaveDayPortion(document.dayPortion),
      status: document.status,
      punchDate: input.workDate,
      holidayByDate,
    });
    if (!plan) continue;

    const leaveRequestId = document._id.toHexString();
    const previousStatus = document.status;
    const updated = await requests.findOneAndUpdate(
      { _id: document._id, status: { $in: ["pending", "approved"] } },
      {
        $set: {
          status: "rejected",
          reviewedByUserId: null,
          reviewedAt: input.now,
          rejectionReason: LEAVE_CANCELLED_ON_PUNCH_REASON,
          updatedAt: input.now,
        },
      },
      { returnDocument: "after" },
    );
    if (!updated) continue;

    await database.collection("auditEvents").insertOne({
      actorFirebaseUid: input.user.firebaseUid,
      targetUserId: userId,
      action: "leave.cancelled_on_punch",
      metadata: {
        leaveRequestId,
        punchDate: input.workDate,
        previousStatus,
        newStatus: "rejected",
        startDate: document.startDate,
        endDate: document.endDate,
        leaveType: document.leaveType,
        dayPortion: normalizeLeaveDayPortion(document.dayPortion),
        rejectionReason: LEAVE_CANCELLED_ON_PUNCH_REASON,
        mode: "reject",
      },
      createdAt: input.now,
    });

    const range = formatLeaveDateRangeLabel(document.startDate, document.endDate);
    const body = `Your leave request for ${range} was rejected.\nReason: ${LEAVE_CANCELLED_ON_PUNCH_REASON}`;
    await database.collection<NotificationDocument>("notifications").insertOne({
      recipientUserId: userId,
      type: "leave_rejected",
      title: "Leave Request Rejected",
      body,
      resource: { kind: "leave_request", id: document._id },
      isRead: false,
      createdAt: input.now,
      readAt: null,
    });
    queueNotificationEmail({
      recipientUserId: input.user.id,
      type: "leave_rejected",
      title: "Leave Request Rejected",
      body,
    });
  }
}

/** Repair: reject full-day leave that still shows approved after a punch was recorded. */
async function reconcileUserFullDayLeavesRejectedByPunch(user: DevSyncUser) {
  const database = await getMongoDatabase();
  const leaves = await database
    .collection<LeaveRequestDocument>("leaveRequests")
    .find({
      userId: objectId(user.id, "user ID"),
      status: { $in: ["pending", "approved"] },
    })
    .toArray();
  if (!leaves.length) return;

  let minDate = leaves[0].startDate;
  let maxDate = leaves[0].endDate;
  for (const leave of leaves) {
    if (leave.startDate < minDate) minDate = leave.startDate;
    if (leave.endDate > maxDate) maxDate = leave.endDate;
  }

  const attendance = await listAttendance({
    userId: user.id,
    from: minDate,
    toExclusive: nextDateKey(maxDate),
  });
  const punchedDates = [
    ...new Set(
      attendance
        .filter((row) => Boolean(row.punchInAt))
        .map((row) => row.workDate),
    ),
  ];
  if (!punchedDates.length) return;

  const now = new Date();
  for (const workDate of punchedDates) {
    await cancelFullDayLeaveCoveringPunchDate({ user, workDate, now });
  }
}

export async function punchIn(
  user: DevSyncUser,
  device: AttendanceDocument["device"],
  now?: Date
) {
  assertAttendanceTracked(user, "punch in");
  const timestamp = now ?? (await serverNow());
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const attendance = database.collection<AttendanceDocument>("attendance");
  const userId = objectId(user.id, "user ID");
  const workDate = indiaDateKey(timestamp);
  const existing = await attendance.findOne({ userId, workDate });
  if (existing)
    throw new Error(
      existing.state === "working"
        ? "You have already punched in today."
        : "Your attendance is already closed for today."
    );

  const document: AttendanceDocument = {
    userId,
    workDate,
    punchInAt: timestamp,
    punchInSource: "employee",
    punchInRecordedByUserId: null,
    punchInRecordedByRole: null,
    classification: classifyPunchIn(timestamp),
    state: "working",
    device,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const result = await attendance.insertOne(document);
  await cancelFullDayLeaveCoveringPunchDate({
    user,
    workDate,
    now: timestamp,
  });
  return mapAttendance({ ...document, _id: result.insertedId });
}

export async function punchOut(user: DevSyncUser, now?: Date) {
  assertAttendanceTracked(user, "punch out");
  const timestamp = now ?? (await serverNow());
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const attendance = database.collection<AttendanceDocument>("attendance");
  const userId = objectId(user.id, "user ID");
  const workDate = indiaDateKey(timestamp);

  if (requiresWorkUpdateBeforePunchOut(user.role)) {
    const todaysUpdate = await database
      .collection<WorkUpdateDocument>("workUpdates")
      .findOne({ userId, updateDate: workDate });
    assertWorkUpdateSubmittedBeforePunchOut({
      role: user.role,
      hasTodaysWorkUpdate: Boolean(todaysUpdate?.tasks?.length),
    });
  }

  const result = await attendance.findOneAndUpdate(
    { userId, workDate, state: "working" },
    { $set: employeePunchOutFields(timestamp) },
    { returnDocument: "after" }
  );
  if (!result) throw new Error("Punch in before punching out.");
  return mapAttendance(result);
}

export async function getAttendanceForUserDate(
  userId: string,
  workDate: string
) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const document = await database
    .collection<AttendanceDocument>("attendance")
    .findOne({ userId: objectId(userId, "user ID"), workDate });
  return document ? mapAttendance(document) : null;
}

export async function listAttendance(input: {
  workDate?: string;
  userId?: string;
  from?: string;
  toExclusive?: string;
}) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const query: Record<string, unknown> = {};
  if (input.workDate) query.workDate = input.workDate;
  if (input.from || input.toExclusive) {
    const range: Record<string, string> = {};
    if (input.from) range.$gte = input.from;
    if (input.toExclusive) range.$lt = input.toExclusive;
    query.workDate = range;
  }
  if (input.userId) query.userId = objectId(input.userId, "user ID");
  const documents = await database
    .collection<AttendanceDocument>("attendance")
    .find(query)
    .sort({ workDate: 1, punchInAt: 1 })
    .toArray();
  return documents.map(mapAttendance);
}

export async function saveWorkUpdate(
  user: DevSyncUser,
  input: { updateDate: string; tasks: TaskEntry[]; blockers: string | null }
) {
  const now = await serverNow();
  if (!canSubmitUpdateForDate(input.updateDate, now))
    throw new Error(
      "Work updates may only be submitted for today or yesterday."
    );
  const today = indiaDateKey(now);
  const attendance = await getAttendanceForUserDate(user.id, input.updateDate);
  if (!attendance) {
    if (input.updateDate === today) {
      throw new Error("Punch in before submitting a work update.");
    }
    throw new Error(
      "Work updates cannot be submitted for a day with no attendance record."
    );
  }
  if (!input.tasks.length) throw new Error("Add at least one completed task.");
  if (
    input.tasks.some(
      task =>
        !task.description.trim() || task.minutes < 0 || task.minutes > 24 * 60
    )
  )
    throw new Error("Each task needs a description and valid duration.");

  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const workUpdates = database.collection<WorkUpdateDocument>("workUpdates");
  const userId = objectId(user.id, "user ID");
  const normalizedTasks = input.tasks.map(task => ({
    ...task,
    description: task.description.trim(),
  }));
  const totalMinutes = sumTaskMinutes(normalizedTasks);
  await workUpdates.updateOne(
    { userId, updateDate: input.updateDate },
    {
      $set: {
        tasks: normalizedTasks,
        totalMinutes,
        blockers: input.blockers?.trim() || null,
        updatedAt: now,
      },
      $setOnInsert: { userId, updateDate: input.updateDate, submittedAt: now },
    },
    { upsert: true }
  );
  const document = await workUpdates.findOne({
    userId,
    updateDate: input.updateDate,
  });
  if (!document) throw new Error("Work update could not be saved.");
  return mapUpdate(document);
}

export async function listWorkUpdates(input: {
  userId?: string;
  updateDate?: string;
  fromDate?: string;
  toDate?: string;
  query?: string;
}) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const query: Record<string, unknown> = {};
  if (input.userId) query.userId = objectId(input.userId, "user ID");
  if (input.updateDate) query.updateDate = input.updateDate;
  if (input.fromDate || input.toDate)
    query.updateDate = {
      ...(input.fromDate ? { $gte: input.fromDate } : {}),
      ...(input.toDate ? { $lte: input.toDate } : {}),
    };
  if (input.query) {
    const escaped = input.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp(escaped, "i");
    query.$or = [{ "tasks.description": expression }, { blockers: expression }];
  }
  const documents = await database
    .collection<WorkUpdateDocument>("workUpdates")
    .find(query)
    .sort({ updateDate: -1, submittedAt: -1 })
    .toArray();
  return documents.map(mapUpdate);
}

export async function assignTask(
  actor: DevSyncUser,
  input: {
    developerUserId: string;
    description: string;
    priority?: string;
    dueDate?: string | null;
    dueTime?: string | null;
  },
) {
  if (!canViewTeamData(actor))
    throw new Error("Only a Manager or Admin can assign tasks.");
  const description = input.description.trim();
  if (description.length < 3 || description.length > 2000)
    throw new Error("Task description must be between 3 and 2000 characters.");
  const priority = normalizeTaskPriority(input.priority);
  const { dueDate, dueTime } = assertTaskDueInput({
    dueDate: input.dueDate,
    dueTime: input.dueTime,
  });
  const assignee = await getUserById(input.developerUserId);
  if (!assignee || !assignee.isActive)
    throw new Error("Select an active employee.");
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const now = await serverNow();
  const document: AssignedTaskDocument = {
    developerUserId: objectId(input.developerUserId, "developer user ID"),
    assignedByUserId: objectId(actor.id, "actor user ID"),
    description,
    priority,
    dueDate,
    dueTime,
    status: "pending",
    assignedAt: now,
    completedAt: null,
    remarks: [],
    createdAt: now,
    updatedAt: now,
    overdueNotifiedAt: null,
  };
  const result = await database
    .collection<AssignedTaskDocument>("assignedTasks")
    .insertOne(document);
  const notificationBody = buildTaskAssignedNotificationBody({
    description,
    priority,
    dueDate,
    dueTime,
  });
  await database
    .collection<NotificationDocument>("notifications")
    .insertOne({
      recipientUserId: document.developerUserId,
      type: "task_assigned",
      title: "New task assigned",
      body: notificationBody,
      resource: { kind: "assigned_task", id: result.insertedId },
      isRead: false,
      createdAt: now,
      readAt: null,
    });
  queueNotificationEmail({
    recipientUserId: document.developerUserId,
    type: "task_assigned",
    title: "New task assigned",
    body: notificationBody,
    recipientEmail: assignee.email,
  });
  return mapTask({ ...document, _id: result.insertedId });
}

/**
 * Notify assigners when pending tasks pass their due date/time.
 * Creates Signal Center + email + browser push for the assigner (Manager/Admin).
 */
export async function notifyOverdueAssignedTasks(options?: { now?: Date }) {
  const now = options?.now ?? new Date();
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const assignedTasks =
    database.collection<AssignedTaskDocument>("assignedTasks");
  const notifications =
    database.collection<NotificationDocument>("notifications");

  const candidates = await assignedTasks
    .find({
      status: "pending",
      deletedAt: { $exists: false },
      dueDate: { $type: "string" },
      $or: [
        { overdueNotifiedAt: null },
        { overdueNotifiedAt: { $exists: false } },
      ],
    })
    .limit(200)
    .toArray();

  const overdue = candidates.filter(task =>
    isTaskPastDue({
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      now,
    }),
  );

  if (!overdue.length) {
    return {
      ran: true,
      scanned: candidates.length,
      overdue: 0,
      sent: 0,
      failures: 0,
    };
  }

  const users = await listUsers();
  const usersById = new Map(users.map(user => [user.id, user]));

  let sent = 0;
  let failures = 0;

  for (const task of overdue) {
    const assignee = usersById.get(task.developerUserId.toHexString());
    const assigner = usersById.get(task.assignedByUserId.toHexString());
    const assigneeLabel =
      assignee?.displayName || assignee?.email || "An employee";
    const dueLabel =
      formatTaskDueLabel({
        dueDate: task.dueDate,
        dueTime: task.dueTime,
      }) || "the due time";
    const title = "Assigned task overdue";
    const body = [
      `${assigneeLabel} has not completed: ${task.description}`,
      `Priority: ${taskPriorityLabel(normalizeTaskPriority(task.priority))}`,
      `Due: ${dueLabel}`,
    ].join("\n");

    try {
      const update = await assignedTasks.updateOne(
        {
          _id: task._id,
          status: "pending",
          $or: [
            { overdueNotifiedAt: null },
            { overdueNotifiedAt: { $exists: false } },
          ],
        },
        { $set: { overdueNotifiedAt: now, updatedAt: now } },
      );
      if (update.matchedCount === 0) continue;

      await notifications.insertOne({
        recipientUserId: task.assignedByUserId,
        type: TASK_OVERDUE_NOTIFICATION_TYPE,
        title,
        body,
        resource: { kind: "assigned_task", id: task._id },
        isRead: false,
        createdAt: now,
        readAt: null,
      });
      queueNotificationEmail({
        recipientUserId: task.assignedByUserId,
        type: TASK_OVERDUE_NOTIFICATION_TYPE,
        title,
        body,
        recipientEmail: assigner?.email ?? null,
      });
      sent += 1;
    } catch (error) {
      failures += 1;
      console.error(
        "[task-overdue] failed for task",
        task._id.toHexString(),
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }

  console.info(
    `[task-overdue] scanned=${candidates.length} overdue=${overdue.length} sent=${sent} failures=${failures}`,
  );

  return {
    ran: true,
    scanned: candidates.length,
    overdue: overdue.length,
    sent,
    failures,
  };
}

/** Cooldown so manager notification polls do not hammer the overdue scan. */
let lastOverdueNotifySweepMs = 0;
const OVERDUE_NOTIFY_SWEEP_COOLDOWN_MS = 45_000;

/**
 * Throttled overdue sweep for interactive Manager/Admin requests.
 * Cron should call `notifyOverdueAssignedTasks` directly (unthrottled).
 */
export async function maybeNotifyOverdueAssignedTasks(options?: {
  now?: Date;
  force?: boolean;
}) {
  const nowMs = Date.now();
  if (
    !options?.force &&
    nowMs - lastOverdueNotifySweepMs < OVERDUE_NOTIFY_SWEEP_COOLDOWN_MS
  ) {
    return {
      ran: false,
      skipped: true as const,
      scanned: 0,
      overdue: 0,
      sent: 0,
      failures: 0,
    };
  }
  lastOverdueNotifySweepMs = nowMs;
  return notifyOverdueAssignedTasks(options);
}

export async function completeTask(actor: DevSyncUser, taskId: string) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const assignedTasks =
    database.collection<AssignedTaskDocument>("assignedTasks");
  const _id = objectId(taskId, "task ID");
  const task = await assignedTasks.findOne({
    _id,
    deletedAt: { $exists: false },
  });
  if (!task) throw new Error("Task not found.");
  if (
    task.developerUserId.toHexString() !== actor.id &&
    !canViewTeamData(actor)
  )
    throw new Error("You cannot complete this task.");
  if (task.status === "completed") return mapTask(task);
  const now = await serverNow();
  await assignedTasks.updateOne(
    { _id },
    { $set: { status: "completed", completedAt: now, updatedAt: now } }
  );
  await database
    .collection<NotificationDocument>("notifications")
    .insertOne({
      recipientUserId: task.assignedByUserId,
      type: "task_completed",
      title: "Task completed",
      body: `${actor.displayName || actor.email} completed: ${task.description}`,
      resource: { kind: "assigned_task", id: _id },
      isRead: false,
      createdAt: now,
      readAt: null,
    });
  return mapTask({
    ...task,
    _id,
    status: "completed",
    completedAt: now,
    updatedAt: now,
  });
}

export async function addTaskRemark(
  actor: DevSyncUser,
  taskId: string,
  text: string
) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 2000)
    throw new Error("Remark must be between 1 and 2000 characters.");
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const assignedTasks =
    database.collection<AssignedTaskDocument>("assignedTasks");
  const _id = objectId(taskId, "task ID");
  const task = await assignedTasks.findOne({
    _id,
    deletedAt: { $exists: false },
  });
  if (!task) throw new Error("Task not found.");
  if (
    task.developerUserId.toHexString() !== actor.id &&
    !canViewTeamData(actor)
  )
    throw new Error("You cannot comment on this task.");
  const remark: TaskRemark = {
    id: new ObjectId().toHexString(),
    userId: actor.id,
    userName: actor.displayName || actor.email,
    text: trimmed,
    createdAt: new Date(),
  };
  await assignedTasks.updateOne(
    { _id },
    { $push: { remarks: remark }, $set: { updatedAt: remark.createdAt } }
  );
  return remark;
}

export async function listAssignedTasks(input: {
  developerUserId: string;
  status?: AssignedTaskStatus;
  fromDate?: string;
  toDate?: string;
}) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const query: Record<string, unknown> = {
    developerUserId: objectId(input.developerUserId, "developer user ID"),
    deletedAt: { $exists: false },
  };
  if (input.status) query.status = input.status;
  if (input.fromDate || input.toDate) {
    const assignedAt: Record<string, Date> = {};
    if (input.fromDate) {
      assignedAt.$gte = new Date(`${input.fromDate}T00:00:00+05:30`);
    }
    if (input.toDate) {
      assignedAt.$lte = new Date(`${input.toDate}T23:59:59.999+05:30`);
    }
    query.assignedAt = assignedAt;
  }
  const documents = await database
    .collection<AssignedTaskDocument>("assignedTasks")
    .find(query)
    .sort({ assignedAt: -1 })
    .toArray();
  return documents.map(mapTask);
}

export async function deleteAssignedTask(actor: DevSyncUser, taskId: string) {
  if (actor.role !== "admin")
    throw new Error("Only an Admin can delete tasks.");
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const _id = objectId(taskId, "task ID");
  const tasks = database.collection<AssignedTaskDocument>("assignedTasks");
  const task = await tasks.findOne({ _id, deletedAt: { $exists: false } });
  if (!task) throw new Error("Task not found.");
  const now = new Date();
  await tasks.updateOne(
    { _id },
    {
      $set: {
        deletedAt: now,
        deletedByUserId: objectId(actor.id, "actor user ID"),
        updatedAt: now,
      },
    }
  );
  await database.collection("auditEvents").insertOne({
    actorFirebaseUid: actor.firebaseUid,
    targetUserId: task.developerUserId,
    action: "task.deleted",
    metadata: { taskId, status: task.status, description: task.description },
    createdAt: now,
  });
}

export async function listNotifications(
  userId: string,
  options?: { limit?: number; cursor?: string | null },
) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const recipientUserId = objectId(userId, "user ID");
  const limit = Math.min(
    Math.max(options?.limit ?? 20, 1),
    50,
  );

  const filter: Record<string, unknown> = { recipientUserId };
  if (options?.cursor) {
    const [createdAtText, idText] = options.cursor.split("|");
    if (createdAtText && idText && ObjectId.isValid(idText)) {
      const createdAt = new Date(createdAtText);
      const cursorId = new ObjectId(idText);
      if (!Number.isNaN(createdAt.getTime())) {
        filter.$or = [
          { createdAt: { $lt: createdAt } },
          { createdAt, _id: { $lt: cursorId } },
        ];
      }
    }
  }

  const [documents, unreadCount] = await Promise.all([
    database
      .collection<NotificationDocument>("notifications")
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .toArray(),
    database.collection<NotificationDocument>("notifications").countDocuments({
      recipientUserId,
      isRead: false,
    }),
  ]);

  const hasMore = documents.length > limit;
  const page = hasMore ? documents.slice(0, limit) : documents;
  const notifications = page.map(mapNotification);
  const last = page[page.length - 1];
  const nextCursor = hasMore && last
    ? `${last.createdAt.toISOString()}|${last._id.toHexString()}`
    : null;

  return { notifications, unreadCount, hasMore, nextCursor };
}

export async function markNotificationsRead(
  userId: string,
  notificationId?: string
) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const filter: Record<string, unknown> = {
    recipientUserId: objectId(userId, "user ID"),
    isRead: false,
  };
  if (notificationId) filter._id = objectId(notificationId, "notification ID");
  await database
    .collection<NotificationDocument>("notifications")
    .updateMany(filter, { $set: { isRead: true, readAt: new Date() } });
}

export async function deleteNotification(
  userId: string,
  notificationId: string,
) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const result = await database
    .collection<NotificationDocument>("notifications")
    .deleteOne({
      _id: objectId(notificationId, "notification ID"),
      recipientUserId: objectId(userId, "user ID"),
    });
  if (!result.deletedCount) throw new Error("Notification not found.");
  return { deleted: true as const, id: notificationId };
}

export async function clearAllNotifications(userId: string) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const result = await database
    .collection<NotificationDocument>("notifications")
    .deleteMany({ recipientUserId: objectId(userId, "user ID") });
  return { deletedCount: result.deletedCount };
}

async function notifyReviewersOfCorrectionRequest(input: {
  requestId: ObjectId;
  employeeName: string;
  workDate: string;
  correctionType: AttendanceCorrectionType;
  requestedPunchInAt: Date | null;
  requestedPunchOutAt: Date | null;
  now: Date;
}) {
  const database = await getMongoDatabase();
  const reviewers = (await listUsers()).filter(
    (user) => user.isActive && canManagePunchOutCorrections(user.role),
  );
  if (!reviewers.length) return;

  const isPunchIn =
    input.correctionType === "punch_in" ||
    input.correctionType === "punch_in_and_out";
  const time = isPunchIn
    ? input.requestedPunchInAt
    : input.requestedPunchOutAt;
  const timeLabel = time
    ? time.toLocaleString("en-GB", {
        timeZone: INDIA_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "—";
  const title = isPunchIn
    ? "Punch-in correction requested"
    : "Punch-out correction requested";
  const kindLabel =
    input.correctionType === "punch_in_and_out"
      ? "punch-in and punch-out"
      : input.correctionType === "punch_in"
        ? "punch-in"
        : "punch-out";

  await database.collection<NotificationDocument>("notifications").insertMany(
    reviewers.map((reviewer) => ({
      recipientUserId: objectId(reviewer.id, "reviewer user ID"),
      type: (isPunchIn
        ? "punch_in_correction_requested"
        : "punch_out_correction_requested") as NotificationDocument["type"],
      title,
      body: `${input.employeeName} requested ${kindLabel} for ${input.workDate} at ${timeLabel}.`,
      resource: {
        kind: "attendance_punch_out_request" as const,
        id: input.requestId,
      },
      isRead: false,
      createdAt: input.now,
      readAt: null,
    })),
  );

  const requestType = isPunchIn
    ? "punch_in_correction_requested"
    : "punch_out_correction_requested";
  const requestBody = `${input.employeeName} requested ${kindLabel} for ${input.workDate} at ${timeLabel}.`;
  for (const reviewer of reviewers) {
    queueNotificationEmail({
      recipientUserId: reviewer.id,
      type: requestType,
      title,
      body: requestBody,
      recipientEmail: reviewer.email,
    });
  }
}

/** @deprecated Prefer createAttendanceCorrectionRequest — kept for punch-out callers. */
export async function createPunchOutCorrectionRequest(
  user: DevSyncUser,
  input: { workDate: string; requestedPunchOutAt: Date; reason: string },
) {
  return createAttendanceCorrectionRequest(user, {
    workDate: input.workDate,
    correctionType: "punch_out",
    requestedPunchOutAt: input.requestedPunchOutAt,
    requestedPunchInAt: null,
    reason: input.reason,
  });
}

export async function createAttendanceCorrectionRequest(
  user: DevSyncUser,
  input: {
    workDate: string;
    correctionType: AttendanceCorrectionType;
    requestedPunchInAt: Date | null;
    requestedPunchOutAt: Date | null;
    reason: string;
  },
) {
  if (!user.isActive) throw new Error("Inactive accounts cannot request corrections.");
  assertAttendanceTracked(user, "use attendance corrections");
  const now = new Date();
  const today = indiaDateKey(now);
  const yesterday = previousIndiaDateKey(now);
  const correctionType = normalizeCorrectionType(input.correctionType);
  const reason = validateCorrectionReason(input.reason);

  if (correctionType === "punch_out") {
    if (!isPunchOutCorrectionDateAllowed(input.workDate, today, yesterday)) {
      throw new Error(
        "Punch-out corrections may only be submitted for past working days within the last 62 days.",
      );
    }
  } else if (!isPunchInCorrectionDateAllowed(input.workDate, today)) {
    throw new Error(
      "Punch-in corrections may only be submitted for past working days within the last 62 days.",
    );
  }

  const attendance = await getAttendanceForUserDate(user.id, input.workDate);

  let requestedPunchInAt: Date | null = input.requestedPunchInAt;
  let requestedPunchOutAt: Date | null = input.requestedPunchOutAt;
  let attendanceId: ObjectId | null = null;

  if (correctionType === "punch_out") {
    if (!requestedPunchOutAt) throw new Error("Requested punch-out time is required.");
    assertAttendanceOpenForCorrection({
      exists: Boolean(attendance),
      state: attendance?.state ?? null,
      hasPunchOut: Boolean(attendance?.punchOutAt),
    });
    if (!attendance?.punchInAt) {
      throw new Error("Punch-out correction can only be requested while attendance is still open.");
    }
    assertRequestedPunchOutIsValid({
      punchInAt: new Date(attendance.punchInAt),
      requestedPunchOutAt,
      now,
      workDate: input.workDate,
      workDateOfRequested: indiaDateKey(requestedPunchOutAt),
    });
    attendanceId = objectId(attendance.id, "attendance ID");
  } else if (correctionType === "punch_in_and_out") {
    if (!requestedPunchInAt) throw new Error("Requested punch-in time is required.");
    if (!requestedPunchOutAt) {
      throw new Error("Requested punch-out time is required for this correction type.");
    }
    // Create (absent), fill missing side, or edit existing both punches.
    if (attendance && !attendance.punchInAt && !attendance.punchOutAt) {
      throw new Error("Invalid attendance record for punch correction.");
    }
    if (!attendance && input.workDate >= today) {
      throw new Error(
        "Report attendance is only available for previous working days. Use Punch In for today.",
      );
    }
    assertRequestedPunchInIsValid({
      requestedPunchInAt,
      now,
      workDate: input.workDate,
      workDateOfRequested: indiaDateKey(requestedPunchInAt),
      existingPunchOutAt: null,
    });
    assertRequestedPunchOutIsValid({
      punchInAt: requestedPunchInAt,
      requestedPunchOutAt,
      now,
      workDate: input.workDate,
      workDateOfRequested: indiaDateKey(requestedPunchOutAt),
    });
    attendanceId = attendance ? objectId(attendance.id, "attendance ID") : null;
  } else {
    // punch_in — create missing punch-in, or request a corrected punch-in time.
    if (!requestedPunchInAt) throw new Error("Requested punch-in time is required.");
    if (attendance && !attendance.punchOutAt && !attendance.punchInAt) {
      throw new Error("Invalid attendance record for punch-in correction.");
    }
    if (!attendance && input.workDate >= today) {
      throw new Error(
        "Report attendance is only available for previous working days. Use Punch In for today.",
      );
    }
    assertRequestedPunchInIsValid({
      requestedPunchInAt,
      now,
      workDate: input.workDate,
      workDateOfRequested: indiaDateKey(requestedPunchInAt),
      existingPunchOutAt: attendance?.punchOutAt
        ? new Date(attendance.punchOutAt)
        : null,
    });
    requestedPunchOutAt = null;
    attendanceId = attendance ? objectId(attendance.id, "attendance ID") : null;
  }

  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const requests = database.collection<AttendancePunchOutRequestDocument>(
    "attendancePunchOutRequests",
  );
  const existing = await requests.findOne({
    userId: objectId(user.id, "user ID"),
    workDate: input.workDate,
    correctionType,
    status: "pending",
  });
  if (existing) {
    throw new Error("You have already submitted a correction request for this date.");
  }

  const document: AttendancePunchOutRequestDocument = {
    userId: objectId(user.id, "user ID"),
    attendanceId,
    workDate: input.workDate,
    correctionType,
    requestedPunchInAt,
    requestedPunchOutAt,
    reason,
    status: "pending",
    reviewedByUserId: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: now,
    updatedAt: now,
  };

  let insertedId: ObjectId;
  try {
    const result = await requests.insertOne(document);
    insertedId = result.insertedId;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      throw new Error(
        "You have already submitted a correction request for this date.",
      );
    }
    throw error;
  }

  await notifyReviewersOfCorrectionRequest({
    requestId: insertedId,
    employeeName: user.displayName || user.email,
    workDate: input.workDate,
    correctionType,
    requestedPunchInAt,
    requestedPunchOutAt,
    now,
  });

  return mapPunchOutRequest({ ...document, _id: insertedId });
}

export async function getPunchOutCorrectionRequestForAttendance(
  userId: string,
  attendanceId: string,
) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const document = await database
    .collection<AttendancePunchOutRequestDocument>("attendancePunchOutRequests")
    .findOne({
      userId: objectId(userId, "user ID"),
      attendanceId: objectId(attendanceId, "attendance ID"),
    });
  return document ? mapPunchOutRequest(document) : null;
}

export async function listMyPunchOutCorrectionRequests(userId: string) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const documents = await database
    .collection<AttendancePunchOutRequestDocument>("attendancePunchOutRequests")
    .find({ userId: objectId(userId, "user ID") })
    .sort({ workDate: -1, createdAt: -1 })
    .toArray();
  return documents.map(mapPunchOutRequest);
}

export async function listMyPunchOutCorrectionRequestsInRange(
  userId: string,
  from: string,
  toExclusive: string,
) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const documents = await database
    .collection<AttendancePunchOutRequestDocument>("attendancePunchOutRequests")
    .find({
      userId: objectId(userId, "user ID"),
      workDate: { $gte: from, $lt: toExclusive },
    })
    .sort({ workDate: 1, createdAt: -1 })
    .toArray();
  return documents.map(mapPunchOutRequest);
}

/** Authenticated employee month ledger — always scoped to the session user. */
export async function getAttendanceMonthLedger(
  user: DevSyncUser,
  month: string,
): Promise<AttendanceMonthLedger> {
  assertAttendanceTracked(user, "have an attendance ledger");
  if (!isValidMonthKey(month)) throw new Error("Invalid month.");
  const { from, toExclusive } = monthRangeKeys(month);
  const today = indiaDateKey(await serverNow());

  const [records, corrections, leaveInfoByDate, holidayByDate] =
    await Promise.all([
      listAttendance({ userId: user.id, from, toExclusive }),
      listMyPunchOutCorrectionRequestsInRange(user.id, from, toExclusive),
      listLeaveInfoByDateForUser(user.id, from, toExclusive),
      listHolidayInfoByDate(from, toExclusive),
    ]);
  const enriched = await attachPunchOutAudits(records);

  const attendanceByDate = new Map<string, AttendanceDayRecord>();
  for (const record of enriched) {
    attendanceByDate.set(record.workDate, {
      id: record.id,
      workDate: record.workDate,
      punchInAt: record.punchInAt
        ? record.punchInAt instanceof Date
          ? record.punchInAt.toISOString()
          : String(record.punchInAt)
        : undefined,
      punchOutAt: record.punchOutAt
        ? record.punchOutAt instanceof Date
          ? record.punchOutAt.toISOString()
          : String(record.punchOutAt)
        : undefined,
      classification: record.classification,
      state: record.state,
      punchInSource: record.punchInSource,
      punchOutSource: record.punchOutSource,
      punchOutRecordedByUserId: record.punchOutRecordedByUserId,
      punchOutRecordedByRole: record.punchOutRecordedByRole,
      punchInRecordedByUserId: record.punchInRecordedByUserId,
      punchInRecordedByRole: record.punchInRecordedByRole,
      punchOutAudit: record.punchOutAudit ?? null,
      punchInAudit: record.punchInAudit ?? null,
    });
  }

  const correctionByWorkDate = new Map<string, AttendanceDayCorrection>();
  const reviewerIds = [
    ...new Set(
      corrections
        .map(request => request.reviewedByUserId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const reviewersById = new Map<string, DevSyncUser>();
  if (reviewerIds.length) {
    const users = await listUsers();
    for (const candidate of users) {
      if (reviewerIds.includes(candidate.id)) {
        reviewersById.set(candidate.id, candidate);
      }
    }
  }
  for (const request of corrections) {
    const reviewedByRole =
      request.reviewedByRole ??
      (request.reviewedByUserId
        ? reviewersById.get(request.reviewedByUserId)?.role ?? null
        : null);
    const mapped: AttendanceDayCorrection = {
      id: request.id,
      status: request.status,
      correctionType: request.correctionType,
      requestedPunchInAt: request.requestedPunchInAt,
      requestedPunchOutAt: request.requestedPunchOutAt,
      reason: request.reason,
      reviewedAt: request.reviewedAt,
      reviewNote: request.reviewNote,
      reviewedByRole,
    };
    const existing = correctionByWorkDate.get(request.workDate);
    if (!existing) {
      correctionByWorkDate.set(request.workDate, mapped);
      continue;
    }
    // Prefer pending over historical approved/rejected for calendar CTAs.
    if (existing.status !== "pending" && mapped.status === "pending") {
      correctionByWorkDate.set(request.workDate, mapped);
    }
  }

  const approvedLeaveDates = new Set<string>();
  for (const [date, info] of leaveInfoByDate) {
    if (info.status === "approved") approvedLeaveDates.add(date);
  }

  return buildAttendanceMonth({
    month,
    today,
    attendanceByDate,
    correctionByWorkDate,
    approvedLeaveDates,
    leaveInfoByDate,
    holidayByDate,
  });
}

export { toIndiaMonthKey };

export async function listPendingPunchOutCorrectionRequests(
  actor: DevSyncUser,
  workDate?: string,
) {
  if (!canManagePunchOutCorrections(actor.role)) {
    throw new Error("Only a Manager or Admin can review punch-out corrections.");
  }
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const query: Record<string, unknown> = { status: "pending" };
  if (workDate) query.workDate = workDate;
  const documents = await database
    .collection<AttendancePunchOutRequestDocument>("attendancePunchOutRequests")
    .find(query)
    .sort({ workDate: -1, createdAt: -1 })
    .toArray();

  const users = await listUsers();
  const byId = new Map(users.map((user) => [user.id, user]));
  const attendanceIds = documents
    .map((document) => document.attendanceId)
    .filter((id): id is ObjectId => Boolean(id));
  const userIdsWithoutAttendance = documents
    .filter((document) => !document.attendanceId)
    .map((document) => document.userId);
  const workDatesWithoutAttendance = [
    ...new Set(
      documents
        .filter((document) => !document.attendanceId)
        .map((document) => document.workDate),
    ),
  ];
  const attendanceDocs =
    attendanceIds.length || userIdsWithoutAttendance.length
      ? await database
          .collection<AttendanceDocument>("attendance")
          .find({
            $or: [
              ...(attendanceIds.length ? [{ _id: { $in: attendanceIds } }] : []),
              ...(userIdsWithoutAttendance.length
                ? [
                    {
                      userId: { $in: userIdsWithoutAttendance },
                      workDate: { $in: workDatesWithoutAttendance },
                    },
                  ]
                : []),
            ],
          })
          .toArray()
      : [];
  const attendanceById = new Map(
    attendanceDocs.map((document) => [document._id.toHexString(), document]),
  );

  return documents.map((document) => {
    const mapped = mapPunchOutRequest(document);
    const employee = byId.get(mapped.userId);
    let attendance = mapped.attendanceId
      ? attendanceById.get(mapped.attendanceId)
      : undefined;
    if (!attendance) {
      // Absent / report-attendance requests may not have attendanceId yet.
      attendance = attendanceDocs.find(
        (doc) =>
          doc.userId.equals(document.userId) && doc.workDate === document.workDate,
      );
    }
    return {
      ...mapped,
      employeeName: employee?.displayName || employee?.email,
      employeeEmail: employee?.email,
      punchInAt: attendance?.punchInAt?.toISOString(),
      punchOutAt: attendance?.punchOutAt?.toISOString(),
    };
  });
}

export async function approvePunchOutCorrectionRequest(
  actor: DevSyncUser,
  requestId: string,
) {
  if (!canManagePunchOutCorrections(actor.role)) {
    throw new Error("Only a Manager or Admin can review punch-out corrections.");
  }
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const requests = database.collection<AttendancePunchOutRequestDocument>(
    "attendancePunchOutRequests",
  );
  const attendance = database.collection<AttendanceDocument>("attendance");
  const _id = objectId(requestId, "request ID");
  const request = await requests.findOne({ _id });
  if (!request) throw new Error("Correction request not found.");
  assertRequestPending(request.status);

  const correctionType = normalizeCorrectionType(request.correctionType);
  const now = new Date();
  let attendanceUpdate: WithId<AttendanceDocument> | null = null;

  if (correctionType === "punch_out") {
    if (!request.attendanceId || !request.requestedPunchOutAt) {
      throw new Error("Invalid punch-out correction request.");
    }
    const attendanceDoc = await attendance.findOne({ _id: request.attendanceId });
    assertAttendanceStillOpenForApproval({
      exists: Boolean(attendanceDoc),
      state: attendanceDoc?.state ?? null,
      hasPunchOut: Boolean(attendanceDoc?.punchOutAt),
    });
    if (!attendanceDoc) throw new Error("Attendance record not found.");
    if (!attendanceDoc.userId.equals(request.userId)) {
      throw new Error("Attendance record does not match this correction request.");
    }
    if (attendanceDoc.workDate !== request.workDate) {
      throw new Error("Attendance record does not match this correction request.");
    }

    attendanceUpdate = await attendance.findOneAndUpdate(
      {
        _id: request.attendanceId,
        userId: request.userId,
        state: "working",
        punchOutAt: { $exists: false },
      },
      {
        $set: {
          state: "punched_out",
          punchOutAt: request.requestedPunchOutAt,
          punchOutSource: "regularization",
          punchOutRecordedByUserId: objectId(actor.id, "actor user ID"),
          punchOutRecordedByRole: actor.role,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );
    if (!attendanceUpdate) {
      throw new Error(
        "Attendance has already been punched out and cannot be overwritten.",
      );
    }
  } else {
    if (!request.requestedPunchInAt) {
      throw new Error("Invalid punch-in correction request.");
    }
    const existing = await attendance.findOne({
      userId: request.userId,
      workDate: request.workDate,
    });
    const classification = classifyPunchIn(request.requestedPunchInAt);
    const includeOut =
      correctionType === "punch_in_and_out" && request.requestedPunchOutAt;
    const isEditBoth =
      Boolean(existing?.punchInAt) &&
      correctionType === "punch_in_and_out" &&
      Boolean(request.requestedPunchOutAt);
    const isEditPunchInOnly =
      Boolean(existing?.punchInAt) && correctionType === "punch_in";

    if (isEditBoth && existing) {
      // Employee requested an edit of existing punch-in and punch-out times
      // (or punch-in today + add punch-out).
      attendanceUpdate = await attendance.findOneAndUpdate(
        { _id: existing._id, userId: request.userId },
        {
          $set: {
            punchInAt: request.requestedPunchInAt,
            punchOutAt: request.requestedPunchOutAt!,
            punchInSource: "regularization",
            punchOutSource: "regularization",
            punchInRecordedByUserId: objectId(actor.id, "actor user ID"),
            punchOutRecordedByUserId: objectId(actor.id, "actor user ID"),
            punchInRecordedByRole: actor.role,
            punchOutRecordedByRole: actor.role,
            classification,
            state: "punched_out",
            updatedAt: now,
          },
        },
        { returnDocument: "after" },
      );
      if (!attendanceUpdate) {
        throw new Error("Attendance record could not be updated.");
      }
    } else if (isEditPunchInOnly && existing) {
      // Correct an existing punch-in (e.g. forgot earlier, punched late).
      assertRequestedPunchInIsValid({
        requestedPunchInAt: request.requestedPunchInAt,
        now,
        workDate: request.workDate,
        workDateOfRequested: indiaDateKey(request.requestedPunchInAt),
        existingPunchOutAt: existing.punchOutAt
          ? new Date(existing.punchOutAt)
          : null,
      });
      attendanceUpdate = await attendance.findOneAndUpdate(
        { _id: existing._id, userId: request.userId },
        {
          $set: {
            punchInAt: request.requestedPunchInAt,
            punchInSource: "regularization",
            punchInRecordedByUserId: objectId(actor.id, "actor user ID"),
            punchInRecordedByRole: actor.role,
            classification,
            state: existing.punchOutAt ? "punched_out" : "working",
            updatedAt: now,
          },
        },
        { returnDocument: "after" },
      );
      if (!attendanceUpdate) {
        throw new Error("Attendance record could not be updated.");
      }
    } else if (existing) {
      // Preserve existing punch-out; only fill missing punch-in.
      const setFields: Record<string, unknown> = {
        punchInAt: request.requestedPunchInAt,
        punchInSource: "regularization",
        punchInRecordedByUserId: objectId(actor.id, "actor user ID"),
        punchInRecordedByRole: actor.role,
        classification,
        updatedAt: now,
      };
      if (includeOut && !existing.punchOutAt) {
        setFields.punchOutAt = request.requestedPunchOutAt;
        setFields.punchOutSource = "regularization";
        setFields.punchOutRecordedByUserId = objectId(actor.id, "actor user ID");
        setFields.punchOutRecordedByRole = actor.role;
        setFields.state = "punched_out";
      } else if (existing.punchOutAt) {
        setFields.state = "punched_out";
      } else {
        setFields.state = "working";
      }

      attendanceUpdate = await attendance.findOneAndUpdate(
        {
          _id: existing._id,
          userId: request.userId,
          punchInAt: { $exists: false },
        },
        { $set: setFields },
        { returnDocument: "after" },
      );
      if (!attendanceUpdate) {
        attendanceUpdate = await attendance.findOneAndUpdate(
          {
            _id: existing._id,
            userId: request.userId,
            $or: [
              { punchInAt: { $exists: false } },
              { punchInAt: { $eq: null as unknown as Date } },
            ],
          },
          { $set: setFields },
          { returnDocument: "after" },
        );
      }
      if (!attendanceUpdate) {
        throw new Error("Punch-in is already recorded and cannot be overwritten.");
      }
    } else {
      const document: AttendanceDocument = {
        userId: request.userId,
        workDate: request.workDate,
        punchInAt: request.requestedPunchInAt,
        punchInSource: "regularization",
        punchInRecordedByUserId: objectId(actor.id, "actor user ID"),
        punchInRecordedByRole: actor.role,
        classification,
        state: includeOut ? "punched_out" : "working",
        device: { ipAddress: null, userAgent: null },
        createdAt: now,
        updatedAt: now,
        ...(includeOut
          ? {
              punchOutAt: request.requestedPunchOutAt!,
              punchOutSource: "regularization" as const,
              punchOutRecordedByUserId: objectId(actor.id, "actor user ID"),
              punchOutRecordedByRole: actor.role,
            }
          : {}),
      };
      try {
        const inserted = await attendance.insertOne(document);
        attendanceUpdate = { ...document, _id: inserted.insertedId };
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: number }).code === 11000
        ) {
          throw new Error(
            "Attendance already exists for this date and cannot be overwritten.",
          );
        }
        throw error;
      }
    }
  }

  if (
    (correctionType === "punch_in" || correctionType === "punch_in_and_out") &&
    attendanceUpdate?.punchInAt
  ) {
    const employee = await getUserById(request.userId.toHexString());
    if (employee) {
      await cancelFullDayLeaveCoveringPunchDate({
        user: employee,
        workDate: request.workDate,
        now,
      });
    }
  }

  const requestUpdate = await requests.findOneAndUpdate(
    { _id, status: "pending" },
    {
      $set: {
        status: "approved",
        reviewedByUserId: objectId(actor.id, "actor user ID"),
        reviewedByRole: actor.role,
        reviewedAt: now,
        updatedAt: now,
        attendanceId: attendanceUpdate!._id,
      },
    },
    { returnDocument: "after" },
  );
  if (!requestUpdate) {
    throw new Error("This correction request has already been reviewed.");
  }

  const isPunchIn =
    correctionType === "punch_in" || correctionType === "punch_in_and_out";
  await database.collection("auditEvents").insertOne({
    actorFirebaseUid: actor.firebaseUid,
    targetUserId: request.userId,
    action: isPunchIn
      ? "attendance.punch_in_regularized"
      : "attendance.punch_out_regularized",
    metadata: {
      requestId,
      attendanceId: attendanceUpdate!._id.toHexString(),
      workDate: request.workDate,
      correctionType,
      requestedPunchInAt: request.requestedPunchInAt?.toISOString() ?? null,
      requestedPunchOutAt: request.requestedPunchOutAt?.toISOString() ?? null,
      reason: request.reason,
      approvedByUserId: actor.id,
      approvedByRole: actor.role,
    },
    createdAt: now,
  });

  const timeForLabel = isPunchIn
    ? request.requestedPunchInAt
    : request.requestedPunchOutAt;
  const requestedLabel = timeForLabel
    ? timeForLabel.toLocaleString("en-GB", {
        timeZone: INDIA_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "—";

  await database.collection<NotificationDocument>("notifications").insertOne({
    recipientUserId: request.userId,
    type: isPunchIn
      ? "punch_in_correction_approved"
      : "punch_out_correction_approved",
    title: isPunchIn
      ? "Punch-in correction approved"
      : "Punch-out correction approved",
    body: `Your ${isPunchIn ? "punch-in" : "punch-out"} for ${request.workDate} was approved at ${requestedLabel}.`,
    resource: { kind: "attendance_punch_out_request", id: _id },
    isRead: false,
    createdAt: now,
    readAt: null,
  });
  queueNotificationEmail({
    recipientUserId: request.userId,
    type: isPunchIn
      ? "punch_in_correction_approved"
      : "punch_out_correction_approved",
    title: isPunchIn
      ? "Punch-in correction approved"
      : "Punch-out correction approved",
    body: `Your ${isPunchIn ? "punch-in" : "punch-out"} for ${request.workDate} was approved at ${requestedLabel}.`,
  });

  return {
    request: mapPunchOutRequest(requestUpdate),
    attendance: mapAttendance(attendanceUpdate!),
  };
}

export async function rejectPunchOutCorrectionRequest(
  actor: DevSyncUser,
  requestId: string,
  reviewNote: string,
) {
  if (!canManagePunchOutCorrections(actor.role)) {
    throw new Error("Only a Manager or Admin can review punch-out corrections.");
  }
  const note = validateReviewNote(reviewNote);
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const requests = database.collection<AttendancePunchOutRequestDocument>("attendancePunchOutRequests");
  const _id = objectId(requestId, "request ID");
  const now = new Date();
  const requestUpdate = await requests.findOneAndUpdate(
    { _id, status: "pending" },
    {
      $set: {
        status: "rejected",
        reviewedByUserId: objectId(actor.id, "actor user ID"),
        reviewedByRole: actor.role,
        reviewedAt: now,
        reviewNote: note,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );
  if (!requestUpdate) {
    const existing = await requests.findOne({ _id });
    if (!existing) throw new Error("Correction request not found.");
    throw new Error("This correction request has already been reviewed.");
  }

  const correctionType = normalizeCorrectionType(requestUpdate.correctionType);
  const isPunchIn =
    correctionType === "punch_in" || correctionType === "punch_in_and_out";

  await database.collection("auditEvents").insertOne({
    actorFirebaseUid: actor.firebaseUid,
    targetUserId: requestUpdate.userId,
    action: isPunchIn
      ? "attendance.punch_in_regularization_rejected"
      : "attendance.punch_out_regularization_rejected",
    metadata: {
      requestId,
      attendanceId: requestUpdate.attendanceId?.toHexString() ?? null,
      workDate: requestUpdate.workDate,
      correctionType,
      requestedPunchInAt: requestUpdate.requestedPunchInAt?.toISOString() ?? null,
      requestedPunchOutAt:
        requestUpdate.requestedPunchOutAt?.toISOString() ?? null,
      reason: requestUpdate.reason,
      reviewNote: note,
      rejectedByUserId: actor.id,
    },
    createdAt: now,
  });

  await database.collection<NotificationDocument>("notifications").insertOne({
    recipientUserId: requestUpdate.userId,
    type: isPunchIn
      ? "punch_in_correction_rejected"
      : "punch_out_correction_rejected",
    title: isPunchIn
      ? "Punch-in correction rejected"
      : "Punch-out correction rejected",
    body: `Your ${isPunchIn ? "punch-in" : "punch-out"} correction for ${requestUpdate.workDate} was rejected.\nReason: ${note}`,
    resource: { kind: "attendance_punch_out_request", id: _id },
    isRead: false,
    createdAt: now,
    readAt: null,
  });
  queueNotificationEmail({
    recipientUserId: requestUpdate.userId,
    type: isPunchIn
      ? "punch_in_correction_rejected"
      : "punch_out_correction_rejected",
    title: isPunchIn
      ? "Punch-in correction rejected"
      : "Punch-out correction rejected",
    body: `Your ${isPunchIn ? "punch-in" : "punch-out"} correction for ${requestUpdate.workDate} was rejected.\nReason: ${note}`,
  });

  return mapPunchOutRequest(requestUpdate);
}

export async function manuallyPunchOutEmployee(
  actor: DevSyncUser,
  input: { userId: string; workDate: string; punchOutAt: Date; reason: string },
) {
  if (!canManagePunchOutCorrections(actor.role)) {
    throw new Error("Only a Manager or Admin can manually punch out an employee.");
  }
  const reason = validateCorrectionReason(input.reason);
  const target = await getUserById(input.userId);
  if (!target || !target.isActive) throw new Error("Select an active employee.");
  if (!isAttendanceTrackedRole(target.role)) {
    throw new Error("Admin accounts are not included in attendance.");
  }

  const now = new Date();
  const today = indiaDateKey(now);
  const yesterday = previousIndiaDateKey(now);
  if (!isPunchOutCorrectionDateAllowed(input.workDate, today, yesterday)) {
    throw new Error(
      "Manual punch-out may only be submitted for past working days within the last 62 days.",
    );
  }

  const attendance = await getAttendanceForUserDate(input.userId, input.workDate);
  assertAttendanceOpenForCorrection({
    exists: Boolean(attendance),
    state: attendance?.state ?? null,
    hasPunchOut: Boolean(attendance?.punchOutAt),
  });
  if (!attendance?.punchInAt) {
    throw new Error("Punch-out correction can only be requested while attendance is still open.");
  }
  assertRequestedPunchOutIsValid({
    punchInAt: new Date(attendance.punchInAt),
    requestedPunchOutAt: input.punchOutAt,
    now,
    workDate: input.workDate,
    workDateOfRequested: indiaDateKey(input.punchOutAt),
  });

  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const attendanceCollection = database.collection<AttendanceDocument>("attendance");
  const requests = database.collection<AttendancePunchOutRequestDocument>("attendancePunchOutRequests");
  const attendanceId = objectId(attendance!.id, "attendance ID");

  const pending = await requests.findOne({
    attendanceId,
    status: "pending",
  });

  const updated = await attendanceCollection.findOneAndUpdate(
    {
      _id: attendanceId,
      userId: objectId(input.userId, "user ID"),
      state: "working",
      punchOutAt: { $exists: false },
    },
    {
      $set: {
        state: "punched_out",
        punchOutAt: input.punchOutAt,
        punchOutSource: "manual",
        punchOutRecordedByUserId: objectId(actor.id, "actor user ID"),
        punchOutRecordedByRole: actor.role,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );
  if (!updated) {
    throw new Error("Attendance has already been punched out and cannot be overwritten.");
  }

  if (pending) {
    await requests.updateOne(
      { _id: pending._id, status: "pending" },
      {
        $set: {
          status: "rejected",
          reviewedByUserId: objectId(actor.id, "actor user ID"),
          reviewedAt: now,
          reviewNote:
            "Attendance was manually punched out by a Manager/Admin.",
          updatedAt: now,
        },
      },
    );
  }

  await database.collection("auditEvents").insertOne({
    actorFirebaseUid: actor.firebaseUid,
    targetUserId: objectId(input.userId, "user ID"),
    action: "attendance.punch_out_manual",
    metadata: {
      attendanceId: attendance!.id,
      workDate: input.workDate,
      punchOutAt: input.punchOutAt.toISOString(),
      reason,
      actorUserId: actor.id,
      actorRole: actor.role,
      resolvedRequestId: pending?._id.toHexString() ?? null,
    },
    createdAt: now,
  });

  const punchLabel = input.punchOutAt.toLocaleString("en-GB", {
    timeZone: INDIA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  await database.collection<NotificationDocument>("notifications").insertOne({
    recipientUserId: objectId(input.userId, "user ID"),
    type: "punch_out_manual",
    title: "Attendance punch-out updated",
    body: `A Manager/Admin recorded your punch-out for ${input.workDate} at ${punchLabel}.`,
    resource: null,
    isRead: false,
    createdAt: now,
    readAt: null,
  });

  return mapAttendance(updated);
}

function mapLeaveRequest(document: WithId<LeaveRequestDocument>): LeaveRequest {
  return {
    id: document._id.toHexString(),
    userId: document.userId.toHexString(),
    leaveType: document.leaveType,
    dayPortion: normalizeLeaveDayPortion(document.dayPortion),
    startDate: document.startDate,
    endDate: document.endDate,
    totalDays: document.totalDays,
    reason: document.reason,
    managerRemark: document.managerRemark?.trim() || undefined,
    status: document.status,
    appliedAt: document.appliedAt.toISOString(),
    reviewedByUserId: document.reviewedByUserId
      ? document.reviewedByUserId.toHexString()
      : null,
    reviewedAt: document.reviewedAt ? document.reviewedAt.toISOString() : null,
    rejectionReason: document.rejectionReason,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

async function enrichLeaveRequests(
  documents: WithId<LeaveRequestDocument>[],
): Promise<LeaveRequest[]> {
  if (!documents.length) return [];
  const users = await listUsers();
  const byId = new Map(users.map((user) => [user.id, user]));
  return documents.map((document) => {
    const mapped = mapLeaveRequest(document);
    const employee = byId.get(mapped.userId);
    const reviewer = mapped.reviewedByUserId
      ? byId.get(mapped.reviewedByUserId)
      : null;
    return {
      ...mapped,
      employeeName: employee?.displayName || employee?.email,
      employeeEmail: employee?.email,
      reviewedByName: reviewer
        ? reviewer.displayName || reviewer.email
        : null,
      reviewedByRole: reviewer?.role ?? null,
    };
  });
}

/** Approved + rejected leave overlays for calendar (pending excluded). */
export async function listLeaveInfoByDateForUser(
  userId: string,
  from: string,
  toExclusive: string,
) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const [documents, holidayByDate] = await Promise.all([
    database
      .collection<LeaveRequestDocument>("leaveRequests")
      .find({
        userId: objectId(userId, "user ID"),
        status: { $in: ["approved", "rejected"] },
        startDate: { $lt: toExclusive },
        endDate: { $gte: from },
      })
      .sort({ updatedAt: -1 })
      .toArray(),
    listHolidayInfoByDate(from, toExclusive),
  ]);

  const byDate = new Map<string, AttendanceDayLeaveInfo>();
  for (const document of documents) {
    if (document.status !== "approved" && document.status !== "rejected") {
      continue;
    }
    const info: AttendanceDayLeaveInfo = {
      id: document._id.toHexString(),
      status: document.status,
      dayPortion: normalizeLeaveDayPortion(document.dayPortion),
      leaveType: document.leaveType,
      reason: document.reason?.trim() || null,
      rejectionReason: document.rejectionReason,
    };
    for (const date of eachDateKeyInclusive(document.startDate, document.endDate)) {
      if (date < from || date >= toExclusive) continue;
      if (isLeaveNonWorkingDate(date, holidayByDate)) continue;
      const existing = byDate.get(date);
      // Prefer approved over rejected when both somehow overlap.
      if (!existing || (existing.status !== "approved" && info.status === "approved")) {
        byDate.set(date, info);
      }
    }
  }
  return byDate;
}

/** Approved leave date keys overlapping [from, toExclusive). */
export async function listApprovedLeaveDateKeysForUser(
  userId: string,
  from: string,
  toExclusive: string,
) {
  const byDate = await listLeaveInfoByDateForUser(userId, from, toExclusive);
  const dates = new Set<string>();
  for (const [date, info] of byDate) {
    if (info.status === "approved") dates.add(date);
  }
  return dates;
}

async function notifyLeaveReviewers(input: {
  requestId: ObjectId;
  employeeName: string;
  startDate: string;
  endDate: string;
  now: Date;
}) {
  const database = await getMongoDatabase();
  const reviewers = (await listUsers()).filter(
    (user) => user.isActive && canManageLeaveRequests(user.role),
  );
  if (!reviewers.length) return;

  const range = formatLeaveDateRangeLabel(input.startDate, input.endDate);
  await database.collection<NotificationDocument>("notifications").insertMany(
    reviewers.map((reviewer) => ({
      recipientUserId: objectId(reviewer.id, "reviewer user ID"),
      type: "leave_requested" as const,
      title: "New Leave Request",
      body: `${input.employeeName} has submitted a leave request for ${range}.`,
      resource: { kind: "leave_request" as const, id: input.requestId },
      isRead: false,
      createdAt: input.now,
      readAt: null,
    })),
  );
  const leaveBody = `${input.employeeName} has submitted a leave request for ${range}.`;
  for (const reviewer of reviewers) {
    queueNotificationEmail({
      recipientUserId: reviewer.id,
      type: "leave_requested",
      title: "New Leave Request",
      body: leaveBody,
      recipientEmail: reviewer.email,
    });
  }
}

export async function createLeaveRequest(
  actor: DevSyncUser,
  input: {
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
    dayPortion?: string;
    /** Optional note from applicant or manager/admin. */
    managerRemark?: string;
    /** Manager/Admin only. */
    forUserId?: string;
    /** Manager/Admin only — pending or approved. */
    initialStatus?: "pending" | "approved";
  },
) {
  if (!actor.isActive) throw new Error("Inactive accounts cannot apply for leave.");
  if (!isLeaveType(input.leaveType)) throw new Error("Invalid leave type.");
  const dayPortion = normalizeLeaveDayPortion(input.dayPortion);
  const reason = validateLeaveReason(input.reason);
  const managerRemark = validateLeaveManagerRemark(input.managerRemark);
  const now = new Date();
  const today = indiaDateKey(now);

  const applyingForOther = Boolean(input.forUserId && input.forUserId !== actor.id);
  const wantsDirectStatus =
    input.initialStatus === "pending" || input.initialStatus === "approved";

  if ((applyingForOther || wantsDirectStatus) && !canManageLeaveRequests(actor.role)) {
    throw new Error("Only a Manager or Admin can apply leave for an employee.");
  }

  let targetUser = actor;
  if (input.forUserId) {
    if (!canManageLeaveRequests(actor.role)) {
      throw new Error("Only a Manager or Admin can apply leave for an employee.");
    }
    const found = await getUserById(input.forUserId);
    if (!found || !found.isActive) throw new Error("Select an active employee.");
    targetUser = found;
  }

  const status: LeaveStatus =
    canManageLeaveRequests(actor.role) && input.initialStatus === "approved"
      ? "approved"
      : "pending";

  const holidayByDate = await listHolidayInfoByDate(
    input.startDate,
    nextDateKey(input.endDate),
  );

  const totalDays = assertLeaveDateRangeValid({
    startDate: input.startDate,
    endDate: input.endDate,
    today,
    dayPortion,
    allowPastStart: canManageLeaveRequests(actor.role),
    holidayByDate,
  });

  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const requests = database.collection<LeaveRequestDocument>("leaveRequests");
  const userObjectId = objectId(targetUser.id, "user ID");

  const active = await requests
    .find({
      userId: userObjectId,
      status: { $in: ["pending", "approved"] },
    })
    .toArray();

  for (const existing of active) {
    if (
      existing.leaveType === input.leaveType &&
      existing.startDate === input.startDate &&
      existing.endDate === input.endDate &&
      existing.status === "pending" &&
      !applyingForOther
    ) {
      throw new Error("You have already submitted this leave request.");
    }
    if (
      rangesOverlap(
        existing.startDate,
        existing.endDate,
        input.startDate,
        input.endDate,
      )
    ) {
      throw new Error(
        "This leave overlaps an existing pending or approved leave request.",
      );
    }
  }

  const document: LeaveRequestDocument = {
    userId: userObjectId,
    leaveType: input.leaveType,
    dayPortion,
    startDate: input.startDate,
    endDate: input.endDate,
    totalDays,
    reason,
    ...(managerRemark ? { managerRemark } : {}),
    status,
    appliedAt: now,
    reviewedByUserId:
      status === "approved" ? objectId(actor.id, "actor user ID") : null,
    reviewedAt: status === "approved" ? now : null,
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await requests.insertOne(document);
  await database.collection("auditEvents").insertOne({
    actorFirebaseUid: actor.firebaseUid,
    targetUserId: userObjectId,
    action:
      status === "approved"
        ? "leave.request_created_approved"
        : "leave.request_created",
    metadata: {
      leaveRequestId: result.insertedId.toHexString(),
      leaveType: input.leaveType,
      dayPortion,
      startDate: input.startDate,
      endDate: input.endDate,
      totalDays,
      previousStatus: null,
      newStatus: status,
      performedByUserId: actor.id,
      performedByRole: actor.role,
      forUserId: targetUser.id,
    },
    createdAt: now,
  });

  const range = formatLeaveDateRangeLabel(input.startDate, input.endDate);
  if (status === "pending" && !applyingForOther) {
    await notifyLeaveReviewers({
      requestId: result.insertedId,
      employeeName: targetUser.displayName || targetUser.email,
      startDate: input.startDate,
      endDate: input.endDate,
      now,
    });
  } else if (status === "pending" && applyingForOther) {
    await notifyLeaveReviewers({
      requestId: result.insertedId,
      employeeName: targetUser.displayName || targetUser.email,
      startDate: input.startDate,
      endDate: input.endDate,
      now,
    });
    await database.collection<NotificationDocument>("notifications").insertOne({
      recipientUserId: userObjectId,
      type: "leave_requested",
      title: "Leave Request Submitted",
      body: `A leave request for ${range} was submitted on your behalf.`,
      resource: { kind: "leave_request", id: result.insertedId },
      isRead: false,
      createdAt: now,
      readAt: null,
    });
    queueNotificationEmail({
      recipientUserId: userObjectId,
      type: "leave_requested",
      title: "Leave Request Submitted",
      body: `A leave request for ${range} was submitted on your behalf.`,
      recipientEmail: targetUser.email,
    });
  } else if (status === "approved") {
    await database.collection<NotificationDocument>("notifications").insertOne({
      recipientUserId: userObjectId,
      type: "leave_approved",
      title: "Leave Approved",
      body: `Your leave for ${range} has been recorded as approved.`,
      resource: { kind: "leave_request", id: result.insertedId },
      isRead: false,
      createdAt: now,
      readAt: null,
    });
    queueNotificationEmail({
      recipientUserId: userObjectId,
      type: "leave_approved",
      title: "Leave Approved",
      body: `Your leave for ${range} has been recorded as approved.`,
      recipientEmail: targetUser.email,
    });
  }

  return mapLeaveRequest({ ...document, _id: result.insertedId });
}

export async function listMyLeaveRequests(userId: string) {
  await ensureOperationIndexes();
  const user = await getUserById(userId);
  if (user) {
    await reconcileUserFullDayLeavesRejectedByPunch(user);
  }
  const database = await getMongoDatabase();
  const documents = await database
    .collection<LeaveRequestDocument>("leaveRequests")
    .find({ userId: objectId(userId, "user ID") })
    .sort({ appliedAt: -1 })
    .toArray();
  return enrichLeaveRequests(documents);
}

export async function listLeaveRequestsForReviewers(
  actor: DevSyncUser,
  status?: LeaveStatus | "all",
) {
  if (!canManageLeaveRequests(actor.role)) {
    throw new Error("Only a Manager or Admin can review leave requests.");
  }
  await ensureOperationIndexes();
  const database = await getMongoDatabase();

  const activeLeaves = await database
    .collection<LeaveRequestDocument>("leaveRequests")
    .find({ status: { $in: ["pending", "approved"] } })
    .project({ userId: 1 })
    .toArray();
  const userIds = [
    ...new Set(activeLeaves.map((doc) => doc.userId.toHexString())),
  ];
  if (userIds.length) {
    const users = await listUsers();
    const byId = new Map(users.map((user) => [user.id, user]));
    for (const id of userIds) {
      const user = byId.get(id);
      if (user) await reconcileUserFullDayLeavesRejectedByPunch(user);
    }
  }

  const query: Record<string, unknown> = {};
  if (status && status !== "all") query.status = status;
  const documents = await database
    .collection<LeaveRequestDocument>("leaveRequests")
    .find(query)
    .sort({
      status: 1,
      appliedAt: -1,
    })
    .toArray();

  documents.sort((a, b) => {
    const rank = (s: LeaveStatus) =>
      s === "pending" ? 0 : s === "approved" ? 1 : 2;
    const byStatus = rank(a.status) - rank(b.status);
    if (byStatus !== 0) return byStatus;
    return b.appliedAt.getTime() - a.appliedAt.getTime();
  });

  return enrichLeaveRequests(documents);
}

/** Manager/Admin status-card counts across all leave requests. */
export async function getLeaveStatusSummaryForReviewers(actor: DevSyncUser) {
  if (!canManageLeaveRequests(actor.role)) {
    throw new Error("Only a Manager or Admin can view leave status summary.");
  }
  await ensureOperationIndexes();
  const database = await getMongoDatabase();

  const activeLeaves = await database
    .collection<LeaveRequestDocument>("leaveRequests")
    .find({ status: { $in: ["pending", "approved"] } })
    .project({ userId: 1 })
    .toArray();
  const userIds = [
    ...new Set(activeLeaves.map((doc) => doc.userId.toHexString())),
  ];
  if (userIds.length) {
    const users = await listUsers();
    const byId = new Map(users.map((user) => [user.id, user]));
    for (const id of userIds) {
      const user = byId.get(id);
      if (user) await reconcileUserFullDayLeavesRejectedByPunch(user);
    }
  }

  const rows = await database
    .collection<LeaveRequestDocument>("leaveRequests")
    .aggregate<{ _id: LeaveStatus; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ])
    .toArray();

  return buildLeaveStatusSummary(
    rows.map((row) => ({ status: row._id, count: row.count })),
  );
}

export async function getLeaveRequest(actor: DevSyncUser, requestId: string) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const document = await database
    .collection<LeaveRequestDocument>("leaveRequests")
    .findOne({ _id: objectId(requestId, "leave request ID") });
  if (!document) throw new Error("Leave request not found.");

  const isOwner = document.userId.toHexString() === actor.id;
  if (!isOwner && !canManageLeaveRequests(actor.role)) {
    throw new Error("Forbidden");
  }

  const [enriched] = await enrichLeaveRequests([document]);
  return enriched;
}

export async function approveLeaveRequest(
  actor: DevSyncUser,
  requestId: string,
) {
  if (!canManageLeaveRequests(actor.role)) {
    throw new Error("Only a Manager or Admin can approve leave requests.");
  }
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const requests = database.collection<LeaveRequestDocument>("leaveRequests");
  const _id = objectId(requestId, "leave request ID");
  const now = new Date();

  const updated = await requests.findOneAndUpdate(
    { _id, status: "pending" },
    {
      $set: {
        status: "approved",
        reviewedByUserId: objectId(actor.id, "actor user ID"),
        reviewedAt: now,
        rejectionReason: null,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!updated) {
    const existing = await requests.findOne({ _id });
    if (!existing) throw new Error("Leave request not found.");
    throw new Error("This leave request has already been reviewed.");
  }

  await database.collection("auditEvents").insertOne({
    actorFirebaseUid: actor.firebaseUid,
    targetUserId: updated.userId,
    action: "leave.request_approved",
    metadata: {
      leaveRequestId: requestId,
      leaveType: updated.leaveType,
      dayPortion: normalizeLeaveDayPortion(updated.dayPortion),
      startDate: updated.startDate,
      endDate: updated.endDate,
      totalDays: updated.totalDays,
      previousStatus: "pending",
      newStatus: "approved",
      performedByUserId: actor.id,
      performedByRole: actor.role,
    },
    createdAt: now,
  });

  const range = formatLeaveDateRangeLabel(updated.startDate, updated.endDate);
  await database.collection<NotificationDocument>("notifications").insertOne({
    recipientUserId: updated.userId,
    type: "leave_approved",
    title: "Leave Approved",
    body: `Your leave request for ${range} has been approved.`,
    resource: { kind: "leave_request", id: _id },
    isRead: false,
    createdAt: now,
    readAt: null,
  });
  queueNotificationEmail({
    recipientUserId: updated.userId,
    type: "leave_approved",
    title: "Leave Approved",
    body: `Your leave request for ${range} has been approved.`,
  });

  const [enriched] = await enrichLeaveRequests([updated]);
  return enriched;
}

export async function rejectLeaveRequest(
  actor: DevSyncUser,
  requestId: string,
  rejectionReason: string,
) {
  if (!canManageLeaveRequests(actor.role)) {
    throw new Error("Only a Manager or Admin can reject leave requests.");
  }
  const reason = validateRejectionReason(rejectionReason);
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const requests = database.collection<LeaveRequestDocument>("leaveRequests");
  const _id = objectId(requestId, "leave request ID");
  const now = new Date();

  const existing = await requests.findOne({ _id });
  if (!existing) throw new Error("Leave request not found.");
  assertLeaveCanBeRejected(existing.status);
  const previousStatus = existing.status;

  const updated = await requests.findOneAndUpdate(
    { _id, status: { $in: ["pending", "approved"] } },
    {
      $set: {
        status: "rejected",
        reviewedByUserId: objectId(actor.id, "actor user ID"),
        reviewedAt: now,
        rejectionReason: reason,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!updated) {
    throw new Error("This leave request has already been reviewed.");
  }

  await database.collection("auditEvents").insertOne({
    actorFirebaseUid: actor.firebaseUid,
    targetUserId: updated.userId,
    action: "leave.request_rejected",
    metadata: {
      leaveRequestId: requestId,
      leaveType: updated.leaveType,
      dayPortion: normalizeLeaveDayPortion(updated.dayPortion),
      startDate: updated.startDate,
      endDate: updated.endDate,
      totalDays: updated.totalDays,
      previousStatus,
      newStatus: "rejected",
      rejectionReason: reason,
      performedByUserId: actor.id,
      performedByRole: actor.role,
    },
    createdAt: now,
  });

  const range = formatLeaveDateRangeLabel(updated.startDate, updated.endDate);
  await database.collection<NotificationDocument>("notifications").insertOne({
    recipientUserId: updated.userId,
    type: "leave_rejected",
    title: "Leave Request Rejected",
    body: `Your leave request for ${range} was rejected.\nReason: ${reason}`,
    resource: { kind: "leave_request", id: _id },
    isRead: false,
    createdAt: now,
    readAt: null,
  });
  queueNotificationEmail({
    recipientUserId: updated.userId,
    type: "leave_rejected",
    title: "Leave Request Rejected",
    body: `Your leave request for ${range} was rejected.\nReason: ${reason}`,
  });

  const [enriched] = await enrichLeaveRequests([updated]);
  return enriched;
}

/** Hard-delete a leave request — removes it from history and calendar. */
export async function deleteLeaveRequest(
  actor: DevSyncUser,
  requestId: string,
) {
  if (!canManageLeaveRequests(actor.role)) {
    throw new Error("Only a Manager or Admin can delete leave requests.");
  }
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const requests = database.collection<LeaveRequestDocument>("leaveRequests");
  const _id = objectId(requestId, "leave request ID");
  const existing = await requests.findOne({ _id });
  if (!existing) throw new Error("Leave request not found.");

  await requests.deleteOne({ _id });
  const now = new Date();
  await database.collection("auditEvents").insertOne({
    actorFirebaseUid: actor.firebaseUid,
    targetUserId: existing.userId,
    action: "leave.request_deleted",
    metadata: {
      leaveRequestId: requestId,
      leaveType: existing.leaveType,
      dayPortion: normalizeLeaveDayPortion(existing.dayPortion),
      startDate: existing.startDate,
      endDate: existing.endDate,
      totalDays: existing.totalDays,
      previousStatus: existing.status,
      newStatus: null,
      performedByUserId: actor.id,
      performedByRole: actor.role,
    },
    createdAt: now,
  });

  return { deleted: true as const, id: requestId };
}

/**
 * Admin Dashboard snapshot — aggregates active employees, today's attendance,
 * leave visibility, and overdue assigned tasks without mutating records.
 */
export async function getAdminDashboard(
  actor: DevSyncUser,
  options?: { monthKey?: string },
) {
  if (actor.role !== "admin" && actor.role !== "manager") {
    throw new Error("Only an Admin or Manager can view the dashboard.");
  }

  const today = indiaDateKey();
  const monthKey =
    options?.monthKey && isValidMonthKey(options.monthKey)
      ? options.monthKey
      : toIndiaMonthKey();
  const { from: monthFrom, toExclusive: monthToExclusive } =
    monthRangeKeys(monthKey);
  const monthEnd = addDaysToDateKey(monthToExclusive, -1);
  const upcomingEnd = addDaysToDateKey(today, ADMIN_DASHBOARD_UPCOMING_DAYS);
  const windowStart = monthFrom < today ? monthFrom : today;
  const windowEnd = monthEnd > upcomingEnd ? monthEnd : upcomingEnd;

  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const [users, attendance, leaveDocuments, holidayByDate, pendingTasks, now] =
    await Promise.all([
      listUsers(),
      listAttendance({ workDate: today }),
      database
        .collection<LeaveRequestDocument>("leaveRequests")
        .find({
          $or: [
            { status: "pending" },
            {
              status: "approved",
              startDate: { $lte: windowEnd },
              endDate: { $gte: windowStart },
            },
          ],
        })
        .toArray(),
      listHolidayInfoByDate(monthFrom, monthToExclusive),
      database
        .collection<AssignedTaskDocument>("assignedTasks")
        .find({
          status: "pending",
          deletedAt: { $exists: false },
          dueDate: { $type: "string" },
        })
        .toArray(),
      serverNow(),
    ]);

  const activeUsers = users.filter(
    (user) => user.isActive && isAttendanceTrackedRole(user.role),
  );
  const usersById = new Map(users.map((user) => [user.id, user]));
  const leaves = await enrichLeaveRequests(leaveDocuments);
  const onLeaveToday = filterOnLeaveToday(leaves, today, holidayByDate);
  const punchedInUserIds = attendance
    .filter((record) => Boolean(record.punchInAt))
    .map((record) => record.userId);
  const punchedInSet = new Set(punchedInUserIds);
  // Summary On Leave excludes punched-in half-day / hourly; table still lists all leave today.
  const onLeaveUserIds = [
    ...new Set(
      onLeaveToday
        .filter((row) => !punchedInSet.has(row.employeeId))
        .map((row) => row.employeeId),
    ),
  ];
  const calendarHolidays = [...holidayByDate.entries()]
    .map(([date, info]) => ({
      id: info.id,
      date,
      name: info.name,
      kind: info.kind,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const overdueTasks = filterOverdueAssignedTasks(
    pendingTasks.map((task) => {
      const employeeId = task.developerUserId.toHexString();
      const employee = usersById.get(employeeId);
      return {
        id: task._id.toHexString(),
        employeeId,
        employeeName: employee?.displayName ?? undefined,
        employeeEmail: employee?.email ?? undefined,
        description: task.description,
        priority: task.priority,
        dueDate: task.dueDate ?? null,
        dueTime: task.dueTime ?? null,
      };
    }),
    now,
  );

  return {
    businessDate: today,
    monthKey,
    summary: summarizeAdminAttendance({
      activeUserIds: activeUsers.map((user) => user.id),
      punchedInUserIds,
      onLeaveUserIds,
    }),
    onLeaveToday,
    upcomingLeaves: filterUpcomingApprovedLeaves(leaves, today),
    pendingLeaveRequests: filterPendingLeaveRequests(leaves),
    calendarLeaves: filterApprovedLeavesInRange(leaves, monthFrom, monthEnd),
    calendarHolidays,
    overdueTasks,
  };
}

export type CompanyHoliday = {
  id: string;
  date: string;
  name: string;
  kind: HolidayKind;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
};

function mapCompanyHoliday(
  document: WithId<CompanyHolidayDocument>,
): CompanyHoliday {
  return {
    id: document._id.toHexString(),
    date: document.date,
    name: document.name,
    kind: normalizeHolidayKind(document.kind),
    createdByUserId: document.createdByUserId.toHexString(),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

async function enrichCompanyHolidays(
  documents: WithId<CompanyHolidayDocument>[],
): Promise<CompanyHoliday[]> {
  if (!documents.length) return [];
  const users = await listUsers();
  const byId = new Map(users.map((user) => [user.id, user]));
  return documents.map((document) => {
    const mapped = mapCompanyHoliday(document);
    const creator = byId.get(mapped.createdByUserId);
    return {
      ...mapped,
      createdByName: creator?.displayName || creator?.email,
    };
  });
}

/** Holidays overlapping [from, toExclusive) for attendance calendar overlays. */
export async function listHolidayInfoByDate(
  from: string,
  toExclusive: string,
): Promise<Map<string, AttendanceDayHolidayInfo>> {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const documents = await database
    .collection<CompanyHolidayDocument>("companyHolidays")
    .find({ date: { $gte: from, $lt: toExclusive } })
    .toArray();

  const byDate = new Map<string, AttendanceDayHolidayInfo>();
  for (const document of documents) {
    byDate.set(document.date, {
      id: document._id.toHexString(),
      name: document.name,
      kind: normalizeHolidayKind(document.kind),
    });
  }
  return byDate;
}

export async function listCompanyHolidays(actor: DevSyncUser) {
  if (!actor.isActive) {
    throw new Error("Inactive accounts cannot view holidays.");
  }
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const documents = await database
    .collection<CompanyHolidayDocument>("companyHolidays")
    .find({})
    .sort({ date: 1 })
    .toArray();
  return enrichCompanyHolidays(documents);
}

export async function createCompanyHoliday(
  actor: DevSyncUser,
  input: { date: string; name: string; kind?: HolidayKind },
) {
  if (!canManageHolidays(actor.role)) {
    throw new Error("Only a Manager or Admin can manage holidays.");
  }
  const date = assertHolidayDateValid(input.date);
  const name = validateHolidayName(input.name);
  const kind = normalizeHolidayKind(input.kind);
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const holidays = database.collection<CompanyHolidayDocument>("companyHolidays");
  const existing = await holidays.findOne({ date });
  if (existing) {
    throw new Error("A holiday or week off already exists for this date.");
  }

  const now = new Date();
  const document: CompanyHolidayDocument = {
    date,
    name,
    kind,
    createdByUserId: objectId(actor.id, "actor user ID"),
    createdAt: now,
    updatedAt: now,
  };
  const result = await holidays.insertOne(document);
  await database.collection("auditEvents").insertOne({
    actorFirebaseUid: actor.firebaseUid,
    targetUserId: null,
    action: "holiday.created",
    metadata: {
      holidayId: result.insertedId.toHexString(),
      date,
      name,
      kind,
      kindLabel: holidayKindLabel(kind),
      performedByUserId: actor.id,
      performedByRole: actor.role,
    },
    createdAt: now,
  });

  const [enriched] = await enrichCompanyHolidays([
    { ...document, _id: result.insertedId },
  ]);
  return enriched;
}

export async function deleteCompanyHoliday(
  actor: DevSyncUser,
  holidayId: string,
) {
  if (!canManageHolidays(actor.role)) {
    throw new Error("Only a Manager or Admin can manage holidays.");
  }
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const holidays = database.collection<CompanyHolidayDocument>("companyHolidays");
  const _id = objectId(holidayId, "holiday ID");
  const existing = await holidays.findOne({ _id });
  if (!existing) throw new Error("Holiday not found.");

  await holidays.deleteOne({ _id });
  const now = new Date();
  await database.collection("auditEvents").insertOne({
    actorFirebaseUid: actor.firebaseUid,
    targetUserId: null,
    action: "holiday.deleted",
    metadata: {
      holidayId,
      date: existing.date,
      name: existing.name,
      performedByUserId: actor.id,
      performedByRole: actor.role,
    },
    createdAt: now,
  });

  return { deleted: true as const, id: holidayId };
}

function assertCanViewAttendanceReports(actor: DevSyncUser) {
  if (actor.role !== "admin" && actor.role !== "manager") {
    throw new Error(
      "Only a Manager or Admin can view attendance reports.",
    );
  }
}

function mapReportOverlay(
  document: WithId<AttendanceReportEntryDocument>,
  employeeName?: string,
): AttendanceReportPersistedOverlay {
  const action = isAttendanceReportAction(document.action)
    ? document.action
    : "Other";
  return {
    id: document._id.toHexString(),
    autoKey: document.autoKey,
    date: document.date,
    employeeId: document.employeeId.toHexString(),
    employeeName,
    action,
    details: document.details,
    managerRemark: document.managerRemark ?? "",
    source: document.source,
    deleted: document.deleted,
  };
}

export type AttendanceReportQueryOptions = {
  month?: string;
  fromMonth?: string;
  toMonth?: string;
  employeeId?: string | null;
};

async function buildSingleMonthAttendanceReport(
  actor: DevSyncUser,
  monthKey: string,
) {
  if (!isValidMonthKey(monthKey)) throw new Error("Invalid month.");

  const { from, toExclusive } = monthRangeKeys(monthKey);
  const today = indiaDateKey();

  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const managerObjectId = objectId(actor.id, "manager ID");

  const [users, attendance, leaveDocuments, holidayByDate, overlayDocs] =
    await Promise.all([
      listUsers(),
      listAttendance({ from, toExclusive }),
      database
        .collection<LeaveRequestDocument>("leaveRequests")
        .find({
          status: "approved",
          startDate: { $lte: addDaysToDateKey(toExclusive, -1) },
          endDate: { $gte: from },
        })
        .toArray(),
      listHolidayInfoByDate(from, toExclusive),
      database
        .collection<AttendanceReportEntryDocument>("attendanceReportEntries")
        .find({ monthKey, managerId: managerObjectId })
        .toArray(),
    ]);

  const activeUsers = users.filter(
    (user) => user.isActive && isAttendanceTrackedRole(user.role),
  );
  const employees = activeUsers.map((user) => ({
    id: user.id,
    displayName: user.displayName,
    email: user.email,
  }));
  const employeeNameById = new Map(
    employees.map((employee) => [
      employee.id,
      employee.displayName?.trim() || employee.email,
    ]),
  );

  const holidays = [...holidayByDate.entries()].map(([date, info]) => ({
    date,
    kind: info.kind,
  }));
  const attendanceRows = attendance.map((record) => ({
    userId: record.userId,
    workDate: record.workDate,
    punchInAt: record.punchInAt
      ? record.punchInAt instanceof Date
        ? record.punchInAt.toISOString()
        : String(record.punchInAt)
      : null,
    punchOutAt: record.punchOutAt
      ? record.punchOutAt instanceof Date
        ? record.punchOutAt.toISOString()
        : String(record.punchOutAt)
      : null,
    classification: record.classification,
    punchInSource: record.punchInSource,
    punchOutSource: record.punchOutSource,
  }));
  const leaveRows = leaveDocuments.map((document) => ({
    id: document._id.toHexString(),
    userId: document.userId.toHexString(),
    leaveType: document.leaveType,
    dayPortion: document.dayPortion,
    startDate: document.startDate,
    endDate: document.endDate,
    status: document.status,
  }));

  const autoEntries = generateAttendanceReportEntries({
    monthKey,
    today,
    employees,
    attendance: attendanceRows,
    leaves: leaveRows,
    holidays,
  });

  const overlays = overlayDocs
    .filter((document) =>
      employeeNameById.has(document.employeeId.toHexString()),
    )
    .map((document) =>
      mapReportOverlay(
        document,
        employeeNameById.get(document.employeeId.toHexString()),
      ),
    );

  const entries = mergeAttendanceReportEntries({
    autoEntries,
    overlays,
    employees,
  });

  const workingDays = countMonthWorkingDays(monthKey, holidays);
  const presentByEmployeeId = countPresentDaysByEmployee({
    monthKey,
    today,
    employees,
    attendance: attendanceRows,
    leaves: leaveRows,
    holidays,
  });

  return {
    month: monthKey,
    monthLabel: reportMonthLabel(monthKey),
    summary: summarizeAttendanceReport(entries, employees.length),
    employeeSummary: buildEmployeeSummaries(
      entries,
      employees,
      workingDays,
      presentByEmployeeId,
    ),
    entries,
    employees,
  };
}

function resolveAttendanceReportQuery(
  options?: string | AttendanceReportQueryOptions,
): { fromMonth: string; toMonth: string; employeeId: string | null } {
  if (typeof options === "string" || options == null) {
    const monthKey =
      typeof options === "string" && isValidMonthKey(options)
        ? options
        : toIndiaMonthKey();
    if (!isValidMonthKey(monthKey)) throw new Error("Invalid month.");
    return { fromMonth: monthKey, toMonth: monthKey, employeeId: null };
  }

  const fromMonth =
    (options.fromMonth && isValidMonthKey(options.fromMonth)
      ? options.fromMonth
      : null) ||
    (options.month && isValidMonthKey(options.month) ? options.month : null) ||
    toIndiaMonthKey();
  const toMonth =
    (options.toMonth && isValidMonthKey(options.toMonth)
      ? options.toMonth
      : null) || fromMonth;
  const employeeId = options.employeeId?.trim() || null;
  if (!isValidMonthKey(fromMonth) || !isValidMonthKey(toMonth)) {
    throw new Error("Invalid month.");
  }
  return { fromMonth, toMonth, employeeId };
}

export async function getMonthlyAttendanceReport(
  actor: DevSyncUser,
  options?: string | AttendanceReportQueryOptions,
) {
  assertCanViewAttendanceReports(actor);
  const { fromMonth, toMonth, employeeId } =
    resolveAttendanceReportQuery(options);
  const months = assertAttendanceReportMonthRange(fromMonth, toMonth);

  const slices = [];
  for (const monthKey of months) {
    slices.push(await buildSingleMonthAttendanceReport(actor, monthKey));
  }

  const merged = mergeAttendanceReportSlices(slices, { employeeId });

  return {
    month: merged.month,
    fromMonth: merged.fromMonth,
    toMonth: merged.toMonth,
    monthLabel: merged.monthLabel,
    generatedAt: new Date().toISOString(),
    manager: {
      id: actor.id,
      displayName: actor.displayName,
      email: actor.email,
    },
    summary: merged.summary,
    employeeSummary: merged.employeeSummary,
    monthSummaries: merged.monthSummaries,
    entries: merged.entries,
    employees: merged.employees,
  };
}

export async function createAttendanceReportManualEntry(
  actor: DevSyncUser,
  input: {
    month: string;
    date: string;
    employeeId: string;
    action: string;
    details: string;
    managerRemark?: string;
  },
) {
  assertCanViewAttendanceReports(actor);
  const validated = validateManualReportEntry({
    monthKey: input.month,
    date: input.date,
    employeeId: input.employeeId,
    action: input.action,
    details: input.details,
    managerRemark: input.managerRemark,
  });

  const users = await listUsers();
  const employee = users.find((user) => user.id === validated.employeeId);
  if (!employee || !employee.isActive) {
    throw new Error("Employee not found.");
  }
  if (!isAttendanceTrackedRole(employee.role)) {
    throw new Error("Admin accounts are not included in attendance reports.");
  }

  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const now = new Date();
  const document: AttendanceReportEntryDocument = {
    monthKey: input.month,
    managerId: objectId(actor.id, "manager ID"),
    employeeId: objectId(validated.employeeId, "employee ID"),
    date: validated.date,
    action: validated.action,
    details: validated.details,
    managerRemark: validated.managerRemark,
    source: "manual",
    autoKey: null,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  };
  const result = await database
    .collection<AttendanceReportEntryDocument>("attendanceReportEntries")
    .insertOne(document);

  return getMonthlyAttendanceReport(actor, input.month);
}

export async function updateAttendanceReportEntry(
  actor: DevSyncUser,
  input: {
    month: string;
    id: string;
    action?: string;
    details?: string;
    managerRemark?: string;
  },
) {
  assertCanViewAttendanceReports(actor);
  if (!isValidMonthKey(input.month)) throw new Error("Invalid month.");

  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const collection = database.collection<AttendanceReportEntryDocument>(
    "attendanceReportEntries",
  );
  const managerObjectId = objectId(actor.id, "manager ID");
  const now = new Date();

  // Auto rows use synthetic ids `auto:...` until first edit creates an overlay.
  if (input.id.startsWith("auto:")) {
    const autoKey = input.id.slice("auto:".length);
    const [date, employeeId, ...actionParts] = autoKey.split("|");
    const actionFromKey = actionParts.join("|");
    if (!date || !employeeId || !actionFromKey) {
      throw new Error("Invalid report entry.");
    }
    const nextAction = input.action ?? actionFromKey;
    if (!isAttendanceReportAction(nextAction)) {
      throw new Error("Invalid action.");
    }
    const details = (input.details ?? "").trim();
    if (input.details !== undefined && !details) {
      throw new Error("Details are required.");
    }
    const managerRemark = (input.managerRemark ?? "").trim();
    if (managerRemark.length > 2000) {
      throw new Error("Remark must be at most 2000 characters.");
    }

    const existing = await collection.findOne({
      monthKey: input.month,
      managerId: managerObjectId,
      autoKey,
    });

    const report = await getMonthlyAttendanceReport(actor, input.month);
    const autoRow = report.entries.find((entry) => entry.autoKey === autoKey);
    const baseDetails = details || autoRow?.details || "";
    if (!baseDetails) throw new Error("Details are required.");

    if (existing) {
      await collection.updateOne(
        { _id: existing._id },
        {
          $set: {
            action: nextAction,
            details: baseDetails,
            managerRemark:
              input.managerRemark !== undefined
                ? managerRemark
                : existing.managerRemark,
            deleted: false,
            updatedAt: now,
          },
        },
      );
    } else {
      await collection.insertOne({
        monthKey: input.month,
        managerId: managerObjectId,
        employeeId: objectId(employeeId, "employee ID"),
        date,
        action: nextAction,
        details: baseDetails,
        managerRemark,
        source: autoRow?.source === "leave" ? "leave" : "attendance",
        autoKey,
        deleted: false,
        createdAt: now,
        updatedAt: now,
      });
    }
    return getMonthlyAttendanceReport(actor, input.month);
  }

  const _id = objectId(input.id, "report entry ID");
  const existing = await collection.findOne({
    _id,
    managerId: managerObjectId,
    monthKey: input.month,
  });
  if (!existing) throw new Error("Report entry not found.");

  const nextAction = input.action ?? existing.action;
  if (!isAttendanceReportAction(nextAction)) {
    throw new Error("Invalid action.");
  }
  const details =
    input.details !== undefined ? input.details.trim() : existing.details;
  if (!details) throw new Error("Details are required.");
  if (details.length > 2000) {
    throw new Error("Details must be at most 2000 characters.");
  }
  const managerRemark =
    input.managerRemark !== undefined
      ? input.managerRemark.trim()
      : existing.managerRemark;
  if (managerRemark.length > 2000) {
    throw new Error("Remark must be at most 2000 characters.");
  }

  await collection.updateOne(
    { _id },
    {
      $set: {
        action: nextAction,
        details,
        managerRemark,
        updatedAt: now,
        deleted: false,
      },
    },
  );

  return getMonthlyAttendanceReport(actor, input.month);
}

export async function deleteAttendanceReportEntry(
  actor: DevSyncUser,
  input: { month: string; id: string },
) {
  assertCanViewAttendanceReports(actor);
  if (!isValidMonthKey(input.month)) throw new Error("Invalid month.");

  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const collection = database.collection<AttendanceReportEntryDocument>(
    "attendanceReportEntries",
  );
  const managerObjectId = objectId(actor.id, "manager ID");
  const now = new Date();

  if (input.id.startsWith("auto:")) {
    const autoKey = input.id.slice("auto:".length);
    const [date, employeeId, ...actionParts] = autoKey.split("|");
    const actionFromKey = actionParts.join("|");
    if (!date || !employeeId || !isAttendanceReportAction(actionFromKey)) {
      throw new Error("Invalid report entry.");
    }
    const existing = await collection.findOne({
      monthKey: input.month,
      managerId: managerObjectId,
      autoKey,
    });
    if (existing) {
      await collection.updateOne(
        { _id: existing._id },
        { $set: { deleted: true, updatedAt: now } },
      );
    } else {
      await collection.insertOne({
        monthKey: input.month,
        managerId: managerObjectId,
        employeeId: objectId(employeeId, "employee ID"),
        date,
        action: actionFromKey,
        details: "",
        managerRemark: "",
        source: actionFromKey === "On Leave" ? "leave" : "attendance",
        autoKey,
        deleted: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    return getMonthlyAttendanceReport(actor, input.month);
  }

  const _id = objectId(input.id, "report entry ID");
  const existing = await collection.findOne({
    _id,
    managerId: managerObjectId,
    monthKey: input.month,
  });
  if (!existing) throw new Error("Report entry not found.");

  if (existing.source === "manual" || !existing.autoKey) {
    await collection.deleteOne({ _id });
  } else {
    await collection.updateOne(
      { _id },
      { $set: { deleted: true, updatedAt: now } },
    );
  }

  return getMonthlyAttendanceReport(actor, input.month);
}

