/** DevSync v2 role vocabulary and server-side helpers. UI conditionals must not replace server authorization. */
export const roles = ["developer", "manager", "admin"] as const;
export type Role = (typeof roles)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.includes(value as Role);
}

export function canViewTeamData(role: Role): boolean {
  return role === "admin" || role === "manager";
}

/** Admins are excluded from punch / absent / ledger / attendance reports. */
export function isAttendanceTrackedRole(role: Role | string): boolean {
  return role !== "admin";
}
