import type { Role } from "@/types/common.types";

/** Client-safe permission helpers. Server APIs re-check authorization independently. */
export function canViewTeam(role: Role): boolean {
  return role === "admin" || role === "manager";
}

export function canManageRoles(role: Role): boolean {
  return role === "admin";
}

export function canDeleteTasks(role: Role): boolean {
  return role === "admin";
}

/** Client gate for editing submitted work updates into the Daily work update form. */
export function canEditWorkUpdates(role: Role): boolean {
  return role === "developer" || role === "manager" || role === "admin";
}

/** Client gate for leave review UI — server re-checks independently. */
export function canReviewLeave(role: Role): boolean {
  return role === "admin" || role === "manager";
}

/** Dashboard overview — Admin and Manager. */
export function canViewAdminDashboard(role: Role): boolean {
  return role === "admin" || role === "manager";
}

/** Personal My updates tab — hidden for Admin (they land on Dashboard). */
export function canViewMyUpdates(role: Role): boolean {
  return role !== "admin";
}

/** Personal My Leave panel — hidden for Admin (review panel only). */
export function canViewMyLeave(role: Role): boolean {
  return role !== "admin";
}

/**
 * Developers must submit today's work update before self punch-out.
 * Server re-checks independently.
 */
export function requiresWorkUpdateBeforePunchOut(role: Role): boolean {
  return role === "developer";
}

/**
 * Admins are not attendance-tracked: no punch in/out, absent counts,
 * self ledger, team attendance rows, or attendance-report employees.
 */
export function requiresAttendanceTracking(role: Role): boolean {
  return role !== "admin";
}

/** Holiday management UI — Admin and Manager. */
export function canManageHolidays(role: Role): boolean {
  return role === "admin" || role === "manager";
}

/** Monthly Attendance Reports — Admin and Manager. */
export function canViewAttendanceReports(role: Role): boolean {
  return role === "admin" || role === "manager";
}
