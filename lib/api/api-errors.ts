/** Standardized safe client error status mapping for protected route handlers. */
export function apiError(
  error: unknown,
  fallback: string
): { error: string; status: number } {
  const message = error instanceof Error ? error.message : fallback;
  if (message === "Forbidden" || message === "Unauthenticated") {
    return { error: message, status: message === "Forbidden" ? 403 : 401 };
  }
  if (
    /Only a Manager or Admin|Only an Admin or Manager can view the dashboard|Only an Admin can view the admin dashboard|Only a Manager or Admin can view attendance reports/i.test(
      message,
    )
  ) {
    return { error: message, status: 403 };
  }
  if (/not found/i.test(message)) {
    return { error: message, status: 404 };
  }
  if (
    /already|cannot be overwritten|duplicate|conflict|still open|has already been reviewed|already submitted|pending correction request first|overlaps an existing|Only pending or approved leave|A holiday already exists|A holiday or week off already exists/i.test(
      message,
    )
  ) {
    return { error: message, status: 409 };
  }
  return { error: message, status: 400 };
}
