"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { QUERY_CONFIG } from "@/constants/query-config";
import { queryKeys } from "@/constants/query-keys";
import {
  clearAllNotifications,
  deleteNotification,
  listNotifications,
  markNotificationsRead,
} from "@/features/notifications/api/notifications-api";
import { invalidateNotifications } from "@/lib/query/invalidate";

/**
 * Notification server state.
 * Polling interval is centralized in QUERY_CONFIG so this can later swap to WS/SSE
 * without changing consumers.
 */
export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: queryKeys.notifications.all,
    queryFn: async () =>
      listNotifications({ limit: QUERY_CONFIG.notifications.pageSize }),
    enabled,
    refetchInterval: enabled
      ? QUERY_CONFIG.notifications.refetchInterval
      : false,
  });
}

/** Drawer infinite scroll feed — loads pages as the user scrolls. */
export function useInfiniteNotifications(enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.notifications.infinite,
    queryFn: async ({ pageParam }) =>
      listNotifications({
        limit: QUERY_CONFIG.notifications.pageSize,
        cursor: pageParam,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    enabled,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId?: string) =>
      markNotificationsRead(notificationId),
    onSuccess: async () => {
      await invalidateNotifications(queryClient);
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => deleteNotification(notificationId),
    onSuccess: async () => {
      await invalidateNotifications(queryClient);
    },
  });
}

export function useClearAllNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => clearAllNotifications(),
    onSuccess: async () => {
      await invalidateNotifications(queryClient);
    },
  });
}
