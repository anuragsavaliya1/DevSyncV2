/** Pure assigned-task rules for priority and due dates. */

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

const INDIA_TIME_ZONE = "Asia/Kolkata";

const istDateKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: INDIA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const istTimePartsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: INDIA_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function isTaskPriority(value: unknown): value is TaskPriority {
  return (
    typeof value === "string" &&
    (TASK_PRIORITIES as readonly string[]).includes(value)
  );
}

export function taskPriorityLabel(priority: TaskPriority) {
  if (priority === "low") return "Low";
  if (priority === "medium") return "Medium";
  if (priority === "high") return "High";
  return "High Urgency";
}

export function normalizeTaskPriority(value: unknown): TaskPriority {
  if (isTaskPriority(value)) return value;
  return "medium";
}

/** Today's calendar date in Asia/Kolkata as YYYY-MM-DD. */
export function taskDueMinDateKey(now: Date = new Date()) {
  return istDateKeyFormat.format(now);
}

/** Current HH:mm in Asia/Kolkata (24h). */
export function taskDueMinTimeKey(now: Date = new Date()) {
  const parts = istTimePartsFormat.formatToParts(now);
  const hour = parts.find(part => part.type === "hour")?.value || "00";
  const minute = parts.find(part => part.type === "minute")?.value || "00";
  // en-GB hour12:false can still emit "24" at midnight in some engines.
  const normalizedHour = hour === "24" ? "00" : hour.padStart(2, "0");
  return `${normalizedHour}:${minute.padStart(2, "0")}`;
}

/**
 * Minimum selectable time for a due date.
 * Future dates: any time. Today: current IST time. Past dates: blocked via min date.
 */
export function taskDueMinTimeForDate(
  dueDate: string | null | undefined,
  now: Date = new Date(),
) {
  if (!dueDate) return undefined;
  if (dueDate !== taskDueMinDateKey(now)) return undefined;
  return taskDueMinTimeKey(now);
}

/** Instant for due deadline in Asia/Kolkata. */
export function taskDueInstant(dueDate: string, dueTime: string) {
  return new Date(`${dueDate}T${dueTime}:00+05:30`);
}

export function isTaskPastDue(input: {
  dueDate?: string | null;
  dueTime?: string | null;
  now?: Date;
}) {
  if (!input.dueDate) return false;
  const dueTime = input.dueTime || "23:59";
  const dueAt = taskDueInstant(input.dueDate, dueTime);
  if (Number.isNaN(dueAt.getTime())) return false;
  return (input.now ?? new Date()).getTime() > dueAt.getTime();
}

/** Validate optional due date (YYYY-MM-DD) and time (HH:mm, 24h). */
export function assertTaskDueInput(
  input: {
    dueDate?: string | null;
    dueTime?: string | null;
  },
  now: Date = new Date(),
) {
  const dueDate = input.dueDate?.trim() || null;
  const dueTime = input.dueTime?.trim() || null;

  if (!dueDate && !dueTime) {
    return { dueDate: null, dueTime: null };
  }
  if (!dueDate) {
    throw new Error("Due date is required when due time is set.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw new Error("Invalid due date.");
  }
  if (dueTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime)) {
    throw new Error("Invalid due time.");
  }

  const resolvedDueTime = dueTime || "23:59";
  const minDate = taskDueMinDateKey(now);
  if (dueDate < minDate) {
    throw new Error("Due date cannot be in the past.");
  }

  if (isTaskPastDue({ dueDate, dueTime: resolvedDueTime, now })) {
    throw new Error("Due date and time cannot be in the past.");
  }

  return { dueDate, dueTime: resolvedDueTime };
}

export function formatTaskDueLabel(input: {
  dueDate?: string | null;
  dueTime?: string | null;
}) {
  if (!input.dueDate) return null;
  const dueTime = input.dueTime || "23:59";
  const dueAt = taskDueInstant(input.dueDate, dueTime);
  if (Number.isNaN(dueAt.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: INDIA_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(dueAt);
}

export function buildTaskAssignedNotificationBody(input: {
  description: string;
  priority: TaskPriority;
  dueDate?: string | null;
  dueTime?: string | null;
}) {
  const lines = [
    input.description.trim(),
    `Priority: ${taskPriorityLabel(input.priority)}`,
  ];
  const dueLabel = formatTaskDueLabel(input);
  if (dueLabel) lines.push(`Due: ${dueLabel}`);
  return lines.join("\n");
}

export const TASK_OVERDUE_NOTIFICATION_TYPE = "task_overdue" as const;
