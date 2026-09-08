/** Pure DevSync operational rules that are deterministic and covered by unit tests. */
export const OFFICE_START_MINUTES = 9 * 60;
export const PUNCH_IN_GRACE_MINUTES = 15;

export function classifyOfficePunchIn(minutesAfterMidnight: number): "on_time" | "late" {
  return minutesAfterMidnight <= OFFICE_START_MINUTES + PUNCH_IN_GRACE_MINUTES ? "on_time" : "late";
}

export function isPermittedWorkUpdateDate(workDate: string, today: string, yesterday: string) {
  return workDate === today || workDate === yesterday;
}

export function sumTaskMinutes(tasks: ReadonlyArray<{ minutes: number }>) {
  return tasks.reduce((total, task) => total + task.minutes, 0);
}

export function previousDateKey(businessDate: string) {
  const date = new Date(`${businessDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function isValidWholeHourDuration(minutes: number) {
  return Number.isInteger(minutes) && minutes >= 60 && minutes <= 24 * 60 && minutes % 60 === 0;
}

export function attendanceDurationMinutes(punchInAt: string, punchOutAt: string) {
  return Math.max(0, Math.floor((new Date(punchOutAt).getTime() - new Date(punchInAt).getTime()) / 60_000));
}
