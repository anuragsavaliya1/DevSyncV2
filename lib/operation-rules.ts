/** Pure DevSync operational rules that are deterministic and covered by unit tests. */
export const OFFICE_START_MINUTES = 9 * 60;
export const PUNCH_IN_GRACE_MINUTES = 15;
/** Office end used by Monthly Attendance Report early-departure detection (matches UI copy). */
export const OFFICE_END_MINUTES = 18 * 60 + 30;
/** Standard on-site span from 09:00 → 18:30 IST (used when punch-in is after 09:00). */
export const STANDARD_WORKDAY_MINUTES =
  OFFICE_END_MINUTES - OFFICE_START_MINUTES;

export function classifyOfficePunchIn(
  minutesAfterMidnight: number
): "on_time" | "late" {
  return minutesAfterMidnight <= OFFICE_START_MINUTES + PUNCH_IN_GRACE_MINUTES
    ? "on_time"
    : "late";
}

/**
 * Expected punch-out minutes (IST).
 * At/before 09:00 → 18:30; after 09:00 → punch-in + standard workday (e.g. 09:05 → 18:35).
 */
export function expectedOfficeEndMinutes(punchInMinutes: number) {
  if (punchInMinutes <= OFFICE_START_MINUTES) return OFFICE_END_MINUTES;
  return punchInMinutes + STANDARD_WORKDAY_MINUTES;
}

/**
 * Punch-out strictly before expected end is early for reporting (no grace).
 * Pass punch-in minutes so late arrivals shift the expected end accordingly.
 */
export function classifyOfficePunchOut(
  minutesAfterMidnight: number,
  punchInMinutes?: number
): "on_time" | "early" {
  const expectedEnd =
    punchInMinutes == null
      ? OFFICE_END_MINUTES
      : expectedOfficeEndMinutes(punchInMinutes);
  return minutesAfterMidnight < expectedEnd ? "early" : "on_time";
}

export function isPermittedWorkUpdateDate(
  workDate: string,
  today: string,
  yesterday: string
) {
  return workDate === today || workDate === yesterday;
}

export function sumTaskMinutes(tasks: ReadonlyArray<{ minutes: number }>) {
  return tasks.reduce((total, task) => total + task.minutes, 0);
}

/**
 * Append new draft tasks onto an existing daily update.
 * If the draft contains any existing task ids (Edit flow), treat as a full replace.
 */
export function mergeWorkUpdateTasks<T extends { id: string }>(input: {
  existingTasks: readonly T[];
  draftTasks: readonly T[];
}): T[] {
  if (!input.existingTasks.length) return [...input.draftTasks];
  const existingIds = new Set(input.existingTasks.map(task => task.id));
  const isEditing = input.draftTasks.some(task => existingIds.has(task.id));
  if (isEditing) return [...input.draftTasks];
  return [...input.existingTasks, ...input.draftTasks];
}

export function previousDateKey(businessDate: string) {
  const date = new Date(`${businessDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function isValidWholeHourDuration(minutes: number) {
  return (
    Number.isInteger(minutes) &&
    minutes >= 60 &&
    minutes <= 24 * 60 &&
    minutes % 60 === 0
  );
}

export function attendanceDurationMinutes(
  punchInAt: string,
  punchOutAt: string
) {
  return Math.max(
    0,
    Math.floor(
      (new Date(punchOutAt).getTime() - new Date(punchInAt).getTime()) / 60_000
    )
  );
}

/** Developers must submit today's work update before self punch-out. */
export function requiresWorkUpdateBeforePunchOut(role: string) {
  return role === "developer";
}

export const WORK_UPDATE_REQUIRED_BEFORE_PUNCH_OUT_MESSAGE =
  "First update today's work before punching out.";

export function assertWorkUpdateSubmittedBeforePunchOut(input: {
  role: string;
  hasTodaysWorkUpdate: boolean;
}) {
  if (!requiresWorkUpdateBeforePunchOut(input.role)) return;
  if (!input.hasTodaysWorkUpdate) {
    throw new Error(WORK_UPDATE_REQUIRED_BEFORE_PUNCH_OUT_MESSAGE);
  }
}
