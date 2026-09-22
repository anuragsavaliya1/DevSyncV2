/** Pure validation and authorization for company holidays. */
import { isValidLeaveDateKey } from "@/lib/leave-rules";

export const HOLIDAY_KINDS = ["holiday", "weekoff"] as const;
export type HolidayKind = (typeof HOLIDAY_KINDS)[number];

export function canManageHolidays(role: string) {
  return role === "admin" || role === "manager";
}

export function isHolidayKind(value: unknown): value is HolidayKind {
  return (
    typeof value === "string" &&
    (HOLIDAY_KINDS as readonly string[]).includes(value)
  );
}

export function normalizeHolidayKind(value: unknown): HolidayKind {
  return isHolidayKind(value) ? value : "holiday";
}

export function holidayKindLabel(kind: HolidayKind) {
  return kind === "weekoff" ? "Week off" : "Holiday";
}

export function validateHolidayName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Holiday name is required.");
  if (trimmed.length > 120) {
    throw new Error("Holiday name must be at most 120 characters.");
  }
  return trimmed;
}

export function assertHolidayDateValid(date: string) {
  if (!isValidLeaveDateKey(date)) {
    throw new Error("Invalid holiday date.");
  }
  return date;
}
