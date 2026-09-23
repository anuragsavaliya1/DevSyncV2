import { apiRequest } from "@/lib/api/api-client";
import {
  appendListPageParams,
  normalizePaginatedList,
  type ListPageQuery,
} from "@/lib/pagination";
import type { Role, WorkspaceUser } from "@/types/common.types";

export async function listAdminUsers(page?: ListPageQuery | null) {
  const params = new URLSearchParams();
  appendListPageParams(params, page);
  const query = params.toString();
  const data = await apiRequest<{
    users: WorkspaceUser[];
    total?: number;
    start?: number;
    limit?: number;
  }>(`/api/admin/users${query ? `?${query}` : ""}`);
  if (!page) return { users: data.users };
  return {
    users: data.users,
    page: normalizePaginatedList(data.users, data, page),
  };
}

export async function changeUserRole(userId: string, role: Role) {
  return apiRequest<{ user: WorkspaceUser }>(
    `/api/admin/users/${userId}/role`,
    {
      method: "PATCH",
      body: JSON.stringify({ role }),
    },
  );
}

export async function changeUserActivity(userId: string, isActive: boolean) {
  return apiRequest<{ user: WorkspaceUser }>(
    `/api/admin/users/${userId}/activity`,
    {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    },
  );
}

export async function deleteUser(userId: string) {
  return apiRequest<{ success: boolean }>(`/api/admin/users/${userId}`, {
    method: "DELETE",
  });
}
