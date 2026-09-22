import { apiRequest } from "@/lib/api/api-client";
import { routes } from "@/constants/routes";
import type { WorkspaceUser } from "@/types/common.types";

export async function createSession(idToken: string) {
  return apiRequest<{ user: WorkspaceUser }>("/api/auth/session", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
}

export async function clearSession() {
  return apiRequest<{ success: boolean }>("/api/auth/session", {
    method: "DELETE",
  });
}

export async function getMe() {
  return apiRequest<{ user: WorkspaceUser | null }>("/api/auth/me");
}

export { routes };
