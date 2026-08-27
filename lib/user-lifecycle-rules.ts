/** Pure authorization safeguards for non-destructive employee lifecycle changes. */
export function userActivityChangeError(input: {
  actorUserId: string;
  targetUserId: string;
  targetEmail: string;
  nextIsActive: boolean;
  initialAdminEmail: string;
}): string | null {
  if (!input.nextIsActive && input.actorUserId === input.targetUserId) {
    return "You cannot deactivate your own account.";
  }

  if (!input.nextIsActive && input.targetEmail.trim().toLowerCase() === input.initialAdminEmail.trim().toLowerCase()) {
    return "The initial Admin cannot be deactivated through this endpoint.";
  }

  return null;
}
