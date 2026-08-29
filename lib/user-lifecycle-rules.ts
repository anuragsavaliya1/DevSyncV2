/** Pure authorization safeguards for non-destructive employee lifecycle changes. */
export function userActivityChangeError(input: {
  actorUserId: string;
  targetUserId: string;
  targetEmail: string;
  nextIsActive: boolean;
  initialAdminEmail: string;
  targetRole?: "developer" | "manager" | "admin";
  activeAdminCount?: number;
}): string | null {
  if (!input.nextIsActive && input.actorUserId === input.targetUserId) {
    return "You cannot deactivate your own account.";
  }

  if (!input.nextIsActive && input.targetEmail.trim().toLowerCase() === input.initialAdminEmail.trim().toLowerCase()) {
    return "The initial Admin cannot be deactivated through this endpoint.";
  }

  if (!input.nextIsActive && input.targetRole === "admin" && input.activeAdminCount !== undefined && input.activeAdminCount <= 1) {
    return "The last active Admin cannot be deactivated.";
  }

  return null;
}

export function userPermanentDeleteError(input: {
  actorUserId: string;
  targetUserId: string;
  targetEmail: string;
  targetRole: "developer" | "manager" | "admin";
  initialAdminEmail: string;
}): string | null {
  if (input.actorUserId === input.targetUserId) return "You cannot permanently delete your own account.";
  if (input.targetEmail.trim().toLowerCase() === input.initialAdminEmail.trim().toLowerCase()) return "The initial Admin cannot be permanently deleted.";
  if (input.targetRole === "admin") return "Administrator accounts cannot be permanently deleted from this panel.";
  return null;
}

export function userRoleChangeError(input: {
  targetEmail: string;
  targetRole: "developer" | "manager" | "admin";
  targetIsActive: boolean;
  nextRole: "developer" | "manager" | "admin";
  initialAdminEmail: string;
  activeAdminCount: number;
}): string | null {
  if (input.targetEmail.trim().toLowerCase() === input.initialAdminEmail.trim().toLowerCase() && input.nextRole !== "admin") return "The initial Admin cannot be demoted through this endpoint.";
  if (input.targetRole === "admin" && input.targetIsActive && input.nextRole !== "admin" && input.activeAdminCount <= 1) return "The last active Admin cannot be demoted.";
  return null;
}
