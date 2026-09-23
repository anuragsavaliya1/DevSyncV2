"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import {
  changeUserActivity,
  changeUserRole,
  deleteUser,
  listAdminUsers,
} from "@/features/users/api/users-api";
import type { ListPageQuery } from "@/lib/pagination";
import { invalidateUserRelated, invalidateUsers } from "@/lib/query/invalidate";
import type { Role } from "@/types/common.types";

/** Admin users — full list when Role Management is active (no paging). */
export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.users.list(null),
    queryFn: async () => (await listAdminUsers()).users,
    enabled,
    placeholderData: (previous) => previous,
  });
}

/** Paged admin users for the access-control table. */
export function useAdminUsersPage(page: ListPageQuery, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.users.list(page),
    queryFn: async () => {
      const result = await listAdminUsers(page);
      return result.page!;
    },
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useChangeUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      changeUserRole(userId, role),
    onSuccess: async () => {
      await invalidateUsers(queryClient);
    },
  });
}

export function useChangeUserActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      changeUserActivity(userId, isActive),
    onSuccess: async () => {
      await invalidateUserRelated(queryClient);
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: async () => {
      await invalidateUserRelated(queryClient);
    },
  });
}
