/** App route paths used by client navigation. */
import type { Role, WorkspaceTab } from "@/types/common.types";
import {
  canManageHolidays,
  canManageRoles,
  canViewAdminDashboard,
  canViewAttendanceReports,
  canViewMyUpdates,
  canViewTeam,
} from "@/constants/permissions";

export const routes = {
  home: "/",
  login: "/login",
  loginNative: "/login/native",
  loginContinue: "/login/continue",
  /** Bare dashboard path — server resolves role default tab. */
  dashboard: "/dashboard",
} as const;

const TAB_SEGMENTS: WorkspaceTab[] = [
  "overview",
  "my-updates",
  "team-updates",
  "attendance",
  "leave",
  "holidays",
  "attendance-reports",
  "roles",
];

export type WorkspaceLocation = {
  tab: WorkspaceTab;
  employeeId: string | null;
};

export function isWorkspaceTab(
  value: string | undefined,
): value is WorkspaceTab {
  return Boolean(value && (TAB_SEGMENTS as string[]).includes(value));
}

/** Default landing tab after login — Admin/Manager → Dashboard overview. */
export function defaultWorkspaceTab(role: Role): WorkspaceTab {
  return canViewAdminDashboard(role) ? "overview" : "my-updates";
}

/** Build a dashboard path for a tab and optional employee operations view. */
export function workspacePath(
  tab: WorkspaceTab,
  employeeId?: string | null,
): string {
  if (employeeId) {
    return `/dashboard/employees/${employeeId}`;
  }
  return `/dashboard/${tab}`;
}

/** Parse `/dashboard/...` into the active tab and optional employee id. */
export function parseWorkspaceSlug(slug?: string[] | null): WorkspaceLocation {
  const segments = slug?.filter(Boolean) ?? [];

  if (segments.length === 0) {
    return { tab: "my-updates", employeeId: null };
  }

  if (segments[0] === "employees" && segments[1]) {
    return { tab: "team-updates", employeeId: segments[1] };
  }

  if (isWorkspaceTab(segments[0]) && segments.length === 1) {
    return { tab: segments[0], employeeId: null };
  }

  return { tab: "my-updates", employeeId: null };
}

/** Clamp a workspace location to what the current role may open. */
export function resolveWorkspaceLocation(
  location: WorkspaceLocation,
  role: Role,
): WorkspaceLocation {
  if (location.employeeId && !canViewTeam(role)) {
    return { tab: defaultWorkspaceTab(role), employeeId: null };
  }
  if (location.tab === "overview" && !canViewAdminDashboard(role)) {
    return { tab: defaultWorkspaceTab(role), employeeId: null };
  }
  if (location.tab === "my-updates" && !canViewMyUpdates(role)) {
    return { tab: defaultWorkspaceTab(role), employeeId: null };
  }
  if (location.tab === "team-updates" && !canViewTeam(role)) {
    return { tab: defaultWorkspaceTab(role), employeeId: null };
  }
  if (location.tab === "roles" && !canManageRoles(role)) {
    return { tab: defaultWorkspaceTab(role), employeeId: null };
  }
  if (location.tab === "holidays" && !canManageHolidays(role)) {
    return { tab: defaultWorkspaceTab(role), employeeId: null };
  }
  if (location.tab === "attendance-reports" && !canViewAttendanceReports(role)) {
    return { tab: defaultWorkspaceTab(role), employeeId: null };
  }
  return location;
}
