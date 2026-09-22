"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import {
  changeUserActivity,
  changeUserRole,
  deleteUser,
  listAdminUsers,
} from "@/features/users/api/users-api";
import { invalidateUserRelated, invalidateUsers } from "@/lib/query/invalidate";
import type { Role } from "@/types/common.types";

/** Admin users — fetch only when Role Management is active (no polling). */
export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.users.list,
    queryFn: async () => (await listAdminUsers()).users,
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
