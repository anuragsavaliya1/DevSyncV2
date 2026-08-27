/**
 * MongoDB operational repository for DevSync v2. This module owns the persistent
 * attendance, daily-update, assigned-task, remark, notification, and audit workflows.
 */
import "server-only";
import { ObjectId, type WithId } from "mongodb";
import { getMongoDatabase } from "@/lib/mongodb";
import { classifyOfficePunchIn, isPermittedWorkUpdateDate, sumTaskMinutes } from "@/lib/operation-rules";
import { getUserById, type DevSyncUser } from "@/lib/users";

const INDIA_TIME_ZONE = "Asia/Kolkata";

export type AttendanceClassification = "on_time" | "late";
export type AttendanceState = "working" | "punched_out";
export type AssignedTaskStatus = "pending" | "completed";

export type TaskEntry = { id: string; description: string; minutes: number };
export type TaskRemark = { id: string; userId: string; userName: string; text: string; createdAt: Date };

type AttendanceDocument = {
  userId: ObjectId;
  workDate: string;
  punchInAt: Date;
  punchOutAt?: Date;
  classification: AttendanceClassification;
  state: AttendanceState;
  device: { ipAddress: string | null; userAgent: string | null };
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
  status: AssignedTaskStatus;
  assignedAt: Date;
  completedAt: Date | null;
  remarks: TaskRemark[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  deletedByUserId?: ObjectId;
};

type NotificationDocument = {
  recipientUserId: ObjectId;
  type: "task_assigned" | "task_completed" | "role_changed";
  title: string;
  body: string;
  resource: { kind: "assigned_task"; id: ObjectId } | null;
  isRead: boolean;
  createdAt: Date;
  readAt: Date | null;
};

export type AttendanceRecord = Omit<AttendanceDocument, "userId"> & { id: string; userId: string };
export type WorkUpdate = Omit<WorkUpdateDocument, "userId"> & { id: string; userId: string };
export type AssignedTask = Omit<AssignedTaskDocument, "developerUserId" | "assignedByUserId"> & { id: string; developerUserId: string; assignedByUserId: string };
export type Notification = Omit<NotificationDocument, "recipientUserId" | "resource"> & { id: string; recipientUserId: string; resource: { kind: "assigned_task"; id: string } | null };

let indexesPromise: Promise<void> | undefined;

async function ensureOperationIndexes() {
  if (!indexesPromise) {
    indexesPromise = (async () => {
      const database = await getMongoDatabase();
      await Promise.all([
        database.collection<AttendanceDocument>("attendance").createIndex({ userId: 1, workDate: 1 }, { unique: true }),
        database.collection<AttendanceDocument>("attendance").createIndex({ workDate: 1, punchInAt: 1 }),
        database.collection<WorkUpdateDocument>("workUpdates").createIndex({ userId: 1, updateDate: 1 }, { unique: true }),
        database.collection<WorkUpdateDocument>("workUpdates").createIndex({ updateDate: 1, submittedAt: -1 }),
        database.collection<AssignedTaskDocument>("assignedTasks").createIndex({ developerUserId: 1, status: 1, assignedAt: -1 }),
        database.collection<NotificationDocument>("notifications").createIndex({ recipientUserId: 1, isRead: 1, createdAt: -1 }),
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
  return { ...document, id: document._id.toHexString(), userId: document.userId.toHexString() };
}

function mapUpdate(document: WithId<WorkUpdateDocument>): WorkUpdate {
  return { ...document, id: document._id.toHexString(), userId: document.userId.toHexString() };
}

function mapTask(document: WithId<AssignedTaskDocument>): AssignedTask {
  return { ...document, id: document._id.toHexString(), developerUserId: document.developerUserId.toHexString(), assignedByUserId: document.assignedByUserId.toHexString() };
}

function mapNotification(document: WithId<NotificationDocument>): Notification {
  return { ...document, id: document._id.toHexString(), recipientUserId: document.recipientUserId.toHexString(), resource: document.resource ? { kind: document.resource.kind, id: document.resource.id.toHexString() } : null };
}

function partsInIndia(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: INDIA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

export function indiaDateKey(date = new Date()) {
  const parts = partsInIndia(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function previousIndiaDateKey(date = new Date()) {
  const parts = partsInIndia(date);
  const utcEquivalent = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - 1));
  return `${utcEquivalent.getUTCFullYear()}-${String(utcEquivalent.getUTCMonth() + 1).padStart(2, "0")}-${String(utcEquivalent.getUTCDate()).padStart(2, "0")}`;
}

export function classifyPunchIn(timestamp = new Date()): AttendanceClassification {
  const parts = partsInIndia(timestamp);
  return classifyOfficePunchIn(parts.hour * 60 + parts.minute);
}

export function canSubmitUpdateForDate(workDate: string, now = new Date()) {
  return isPermittedWorkUpdateDate(workDate, indiaDateKey(now), previousIndiaDateKey(now));
}

export function canViewTeamData(user: DevSyncUser) {
  return user.role === "admin" || user.role === "manager";
}

export async function punchIn(user: DevSyncUser, device: AttendanceDocument["device"], now = new Date()) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const attendance = database.collection<AttendanceDocument>("attendance");
  const userId = objectId(user.id, "user ID");
  const workDate = indiaDateKey(now);
  const existing = await attendance.findOne({ userId, workDate });
  if (existing) throw new Error(existing.state === "working" ? "You have already punched in today." : "Your attendance is already closed for today.");

  const document: AttendanceDocument = { userId, workDate, punchInAt: now, classification: classifyPunchIn(now), state: "working", device, createdAt: now, updatedAt: now };
  const result = await attendance.insertOne(document);
  return mapAttendance({ ...document, _id: result.insertedId });
}

export async function punchOut(user: DevSyncUser, now = new Date()) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const attendance = database.collection<AttendanceDocument>("attendance");
  const userId = objectId(user.id, "user ID");
  const workDate = indiaDateKey(now);
  const result = await attendance.findOneAndUpdate({ userId, workDate, state: "working" }, { $set: { state: "punched_out", punchOutAt: now, updatedAt: now } }, { returnDocument: "after" });
  if (!result) throw new Error("Punch in before punching out.");
  return mapAttendance(result);
}

export async function getAttendanceForUserDate(userId: string, workDate: string) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const document = await database.collection<AttendanceDocument>("attendance").findOne({ userId: objectId(userId, "user ID"), workDate });
  return document ? mapAttendance(document) : null;
}

export async function listAttendance(input: { workDate?: string; userId?: string }) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const query: Record<string, unknown> = {};
  if (input.workDate) query.workDate = input.workDate;
  if (input.userId) query.userId = objectId(input.userId, "user ID");
  const documents = await database.collection<AttendanceDocument>("attendance").find(query).sort({ punchInAt: -1 }).toArray();
  return documents.map(mapAttendance);
}

export async function saveWorkUpdate(user: DevSyncUser, input: { updateDate: string; tasks: TaskEntry[]; blockers: string | null }) {
  if (!canSubmitUpdateForDate(input.updateDate)) throw new Error("Work updates may only be submitted for today or yesterday.");
  const attendance = await getAttendanceForUserDate(user.id, input.updateDate);
  if (!attendance) throw new Error("Punch in before submitting a work update.");
  if (!input.tasks.length) throw new Error("Add at least one completed task.");
  if (input.tasks.some((task) => !task.description.trim() || task.minutes < 0 || task.minutes > 24 * 60)) throw new Error("Each task needs a description and valid duration.");

  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const workUpdates = database.collection<WorkUpdateDocument>("workUpdates");
  const now = new Date();
  const userId = objectId(user.id, "user ID");
  const normalizedTasks = input.tasks.map((task) => ({ ...task, description: task.description.trim() }));
  const totalMinutes = sumTaskMinutes(normalizedTasks);
  await workUpdates.updateOne({ userId, updateDate: input.updateDate }, { $set: { tasks: normalizedTasks, totalMinutes, blockers: input.blockers?.trim() || null, updatedAt: now }, $setOnInsert: { userId, updateDate: input.updateDate, submittedAt: now } }, { upsert: true });
  const document = await workUpdates.findOne({ userId, updateDate: input.updateDate });
  if (!document) throw new Error("Work update could not be saved.");
  return mapUpdate(document);
}

export async function listWorkUpdates(input: { userId?: string; updateDate?: string; fromDate?: string; toDate?: string; query?: string }) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const query: Record<string, unknown> = {};
  if (input.userId) query.userId = objectId(input.userId, "user ID");
  if (input.updateDate) query.updateDate = input.updateDate;
  if (input.fromDate || input.toDate) query.updateDate = { ...(input.fromDate ? { $gte: input.fromDate } : {}), ...(input.toDate ? { $lte: input.toDate } : {}) };
  if (input.query) {
    const escaped = input.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp(escaped, "i");
    query.$or = [{ "tasks.description": expression }, { blockers: expression }];
  }
  const documents = await database.collection<WorkUpdateDocument>("workUpdates").find(query).sort({ updateDate: -1, submittedAt: -1 }).toArray();
  return documents.map(mapUpdate);
}

export async function assignTask(actor: DevSyncUser, input: { developerUserId: string; description: string }) {
  if (!canViewTeamData(actor)) throw new Error("Only a Manager or Admin can assign tasks.");
  const description = input.description.trim();
  if (description.length < 3 || description.length > 2000) throw new Error("Task description must be between 3 and 2000 characters.");
  const assignee = await getUserById(input.developerUserId);
  if (!assignee || !assignee.isActive) throw new Error("Select an active employee.");
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const now = new Date();
  const document: AssignedTaskDocument = { developerUserId: objectId(input.developerUserId, "developer user ID"), assignedByUserId: objectId(actor.id, "actor user ID"), description, status: "pending", assignedAt: now, completedAt: null, remarks: [], createdAt: now, updatedAt: now };
  const result = await database.collection<AssignedTaskDocument>("assignedTasks").insertOne(document);
  await database.collection<NotificationDocument>("notifications").insertOne({ recipientUserId: document.developerUserId, type: "task_assigned", title: "New task assigned", body: description, resource: { kind: "assigned_task", id: result.insertedId }, isRead: false, createdAt: now, readAt: null });
  return mapTask({ ...document, _id: result.insertedId });
}

export async function completeTask(actor: DevSyncUser, taskId: string) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const assignedTasks = database.collection<AssignedTaskDocument>("assignedTasks");
  const _id = objectId(taskId, "task ID");
  const task = await assignedTasks.findOne({ _id, deletedAt: { $exists: false } });
  if (!task) throw new Error("Task not found.");
  if (task.developerUserId.toHexString() !== actor.id && !canViewTeamData(actor)) throw new Error("You cannot complete this task.");
  if (task.status === "completed") return mapTask(task);
  const now = new Date();
  await assignedTasks.updateOne({ _id }, { $set: { status: "completed", completedAt: now, updatedAt: now } });
  await database.collection<NotificationDocument>("notifications").insertOne({ recipientUserId: task.assignedByUserId, type: "task_completed", title: "Task completed", body: `${actor.displayName || actor.email} completed: ${task.description}`, resource: { kind: "assigned_task", id: _id }, isRead: false, createdAt: now, readAt: null });
  return mapTask({ ...task, _id, status: "completed", completedAt: now, updatedAt: now });
}

export async function addTaskRemark(actor: DevSyncUser, taskId: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 2000) throw new Error("Remark must be between 1 and 2000 characters.");
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const assignedTasks = database.collection<AssignedTaskDocument>("assignedTasks");
  const _id = objectId(taskId, "task ID");
  const task = await assignedTasks.findOne({ _id, deletedAt: { $exists: false } });
  if (!task) throw new Error("Task not found.");
  if (task.developerUserId.toHexString() !== actor.id && !canViewTeamData(actor)) throw new Error("You cannot comment on this task.");
  const remark: TaskRemark = { id: new ObjectId().toHexString(), userId: actor.id, userName: actor.displayName || actor.email, text: trimmed, createdAt: new Date() };
  await assignedTasks.updateOne({ _id }, { $push: { remarks: remark }, $set: { updatedAt: remark.createdAt } });
  return remark;
}

export async function listAssignedTasks(input: { developerUserId: string; status?: AssignedTaskStatus }) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const query: Record<string, unknown> = { developerUserId: objectId(input.developerUserId, "developer user ID"), deletedAt: { $exists: false } };
  if (input.status) query.status = input.status;
  const documents = await database.collection<AssignedTaskDocument>("assignedTasks").find(query).sort({ assignedAt: -1 }).toArray();
  return documents.map(mapTask);
}

export async function deleteAssignedTask(actor: DevSyncUser, taskId: string) {
  if (actor.role !== "admin") throw new Error("Only an Admin can delete tasks.");
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const _id = objectId(taskId, "task ID");
  const tasks = database.collection<AssignedTaskDocument>("assignedTasks");
  const task = await tasks.findOne({ _id, deletedAt: { $exists: false } });
  if (!task) throw new Error("Task not found.");
  const now = new Date();
  await tasks.updateOne({ _id }, { $set: { deletedAt: now, deletedByUserId: objectId(actor.id, "actor user ID"), updatedAt: now } });
  await database.collection("auditEvents").insertOne({
    actorFirebaseUid: actor.firebaseUid,
    targetUserId: task.developerUserId,
    action: "task.archived",
    metadata: { taskId, status: task.status, description: task.description },
    createdAt: now,
  });
}

export async function listNotifications(userId: string) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const documents = await database.collection<NotificationDocument>("notifications").find({ recipientUserId: objectId(userId, "user ID") }).sort({ createdAt: -1 }).limit(100).toArray();
  return documents.map(mapNotification);
}

export async function markNotificationsRead(userId: string, notificationId?: string) {
  await ensureOperationIndexes();
  const database = await getMongoDatabase();
  const filter: Record<string, unknown> = { recipientUserId: objectId(userId, "user ID"), isRead: false };
  if (notificationId) filter._id = objectId(notificationId, "notification ID");
  await database.collection<NotificationDocument>("notifications").updateMany(filter, { $set: { isRead: true, readAt: new Date() } });
}
