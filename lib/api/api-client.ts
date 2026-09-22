/** Shared browser/API fetch helper used by feature API modules. */
export async function apiRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      (data as { error?: string }).error || "The request failed."
    );
  return data as T;
}
