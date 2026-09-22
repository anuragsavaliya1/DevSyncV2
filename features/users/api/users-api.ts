import { apiRequest } from "@/lib/api/api-client";
import type { Role, WorkspaceUser } from "@/types/common.types";

export async function listAdminUsers() {
  return apiRequest<{ users: WorkspaceUser[] }>("/api/admin/users");
}

export async function changeUserRole(userId: string, role: Role) {
  return apiRequest<{ user: WorkspaceUser }>(
    `/api/admin/users/${userId}/role`,
    {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }
  );
}

export async function changeUserActivity(userId: string, isActive: boolean) {
  return apiRequest<{ user: WorkspaceUser }>(
    `/api/admin/users/${userId}/activity`,
    {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }
  );
}

export async function deleteUser(userId: string) {
  return apiRequest<{ success: boolean }>(`/api/admin/users/${userId}`, {
    method: "DELETE",
  });
}
