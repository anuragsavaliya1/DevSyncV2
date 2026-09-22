import { apiRequest } from "@/lib/api/api-client";
import { QUERY_CONFIG } from "@/constants/query-config";
import type { NotificationItem } from "@/types/api.types";

export type NotificationsPage = {
  notifications: NotificationItem[];
  unreadCount: number;
  hasMore: boolean;
  nextCursor: string | null;
};

export async function listNotifications(options?: {
  limit?: number;
  cursor?: string | null;
}) {
  const params = new URLSearchParams();
  params.set(
    "limit",
    String(options?.limit ?? QUERY_CONFIG.notifications.pageSize),
  );
  if (options?.cursor) params.set("cursor", options.cursor);
  return apiRequest<NotificationsPage>(
    `/api/notifications?${params.toString()}`,
  );
}

export async function markNotificationsRead(notificationId?: string) {
  return apiRequest<{ success: boolean }>("/api/notifications", {
    method: "PATCH",
    body: JSON.stringify(notificationId ? { notificationId } : {}),
  });
}

export async function deleteNotification(notificationId: string) {
  const params = new URLSearchParams({ id: notificationId });
  return apiRequest<{ success: boolean; deleted: true; id: string }>(
    `/api/notifications?${params.toString()}`,
    { method: "DELETE" },
  );
}

export async function clearAllNotifications() {
  return apiRequest<{ success: boolean; deletedCount: number }>(
    "/api/notifications?all=true",
    { method: "DELETE" },
  );
}
