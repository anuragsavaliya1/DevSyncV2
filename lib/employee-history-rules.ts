/** Date-bound and text-filter rules for Manager/Admin employee history review. */
export type EmployeeHistoryRange = "last_7_days" | "this_month" | "all_time";

export type EmployeeHistoryFilter = {
  range: EmployeeHistoryRange;
  fromDate?: string;
  toDate?: string;
  query?: string;
};

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

function isDateKey(value: string | undefined): value is string {
  return Boolean(value && dateKeyPattern.test(value));
}

function subtractCalendarDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function firstDayOfMonth(dateKey: string) {
  return `${dateKey.slice(0, 7)}-01`;
}

export function normalizeEmployeeHistoryFilter(
  filter: EmployeeHistoryFilter,
  today: string
) {
  if (!isDateKey(today)) throw new Error("Invalid business date.");
  if (filter.fromDate && !isDateKey(filter.fromDate))
    throw new Error("Invalid start date.");
  if (filter.toDate && !isDateKey(filter.toDate))
    throw new Error("Invalid end date.");
  if (filter.fromDate && filter.toDate && filter.fromDate > filter.toDate)
    throw new Error("Start date cannot be after end date.");

  const explicitBounds = filter.fromDate || filter.toDate;
  const defaultBounds =
    filter.range === "last_7_days"
      ? { fromDate: subtractCalendarDays(today, 6), toDate: today }
      : filter.range === "this_month"
        ? { fromDate: firstDayOfMonth(today), toDate: today }
        : {};

  return {
    fromDate:
      filter.fromDate || (explicitBounds ? undefined : defaultBounds.fromDate),
    toDate:
      filter.toDate || (explicitBounds ? undefined : defaultBounds.toDate),
    query: filter.query?.trim().slice(0, 120) || undefined,
  };
}
