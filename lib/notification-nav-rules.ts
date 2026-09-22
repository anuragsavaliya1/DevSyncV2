/** Maps in-app notification types to workspace destinations. */
import { workspacePath } from "@/constants/routes";
import type { Role, WorkspaceTab } from "@/types/common.types";

/** Tab to open when a Signal Center notification is clicked. */
export function notificationTargetTab(
  type: string,
  role?: Role | null,
): WorkspaceTab {
  switch (type) {
    case "task_assigned":
      return role === "admin" ? "overview" : "my-updates";
    case "task_completed":
    case "task_overdue":
      return role === "developer" || !role ? "my-updates" : "team-updates";
    case "leave_requested":
    case "leave_approved":
    case "leave_rejected":
      return "leave";
    case "punch_out_correction_requested":
    case "punch_in_correction_requested":
    case "punch_out_correction_approved":
    case "punch_in_correction_approved":
    case "punch_out_correction_rejected":
    case "punch_in_correction_rejected":
    case "punch_out_manual":
      return "attendance";
    case "role_changed":
      return role === "admin" ? "roles" : "my-updates";
    default:
      return role === "admin" ? "overview" : "my-updates";
  }
}

/** Dashboard path for a notification click. */
export function notificationHref(type: string, role?: Role | null) {
  return workspacePath(notificationTargetTab(type, role));
}
