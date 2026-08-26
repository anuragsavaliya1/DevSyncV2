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
