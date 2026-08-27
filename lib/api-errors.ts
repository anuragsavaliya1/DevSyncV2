/** Standardized safe client error status mapping for protected route handlers. */
export function apiError(error: unknown, fallback: string): { error: string; status: number } {
  const message = error instanceof Error ? error.message : fallback;
  return { error: message, status: message === "Forbidden" ? 403 : 400 };
}
