"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarCheck2,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  LoaderCircle,
  Shield,
  Trash2,
  UserCog,
  X,
  XCircle,
} from "lucide-react";
import { BusyOverlay } from "@/components/shared/action-loader";
import { EmptyState } from "@/components/shared/error-state";
import {
  useClearAllNotifications,
  useDeleteNotification,
  useInfiniteNotifications,
} from "@/features/notifications/hooks/use-notifications";
import { formatDateNumeric } from "@/features/workspace/utils/format";
import { notificationHref } from "@/lib/notification-nav-rules";
import type { NotificationItem } from "@/types/api.types";
import type { Role } from "@/types/common.types";

type NotificationTone = {
  label: string;
  icon: typeof Bell;
  unread: string;
  read: string;
  hover: string;
  dot: string;
  badge: string;
  iconWrap: string;
  markRead: string;
};

function notificationTone(type: string): NotificationTone {
  switch (type) {
    case "leave_approved":
      return {
        label: "Leave approved",
        icon: CalendarCheck2,
        unread: "border-[#BFE6DF] bg-[#F3FBFA]",
        read: "border-[#E9EFF1] bg-white",
        hover:
          "hover:border-[#8FCFC4] hover:bg-[#EAF7F4] hover:shadow-md hover:-translate-y-0.5",
        dot: "bg-[#0E9384]",
        badge: "bg-[#EAF7F4] text-[#0E9384]",
        iconWrap: "bg-[#EAF7F4] text-[#0E9384]",
        markRead: "text-[#0E9384] hover:text-[#087A6D]",
      };
    case "leave_rejected":
      return {
        label: "Leave rejected",
        icon: CalendarX2,
        unread: "border-[#F0C9C4] bg-[#FFF8F7]",
        read: "border-[#E9EFF1] bg-white",
        hover:
          "hover:border-[#E5A79F] hover:bg-[#FFF1EF] hover:shadow-md hover:-translate-y-0.5",
        dot: "bg-[#A64D43]",
        badge: "bg-[#FFF1EF] text-[#A64D43]",
        iconWrap: "bg-[#FFF1EF] text-[#A64D43]",
        markRead: "text-[#A64D43] hover:text-[#8B3D35]",
      };
    case "leave_requested":
      return {
        label: "Leave request",
        icon: CalendarDays,
        unread: "border-[#F0D9B8] bg-[#FFF9F1]",
        read: "border-[#E9EFF1] bg-white",
        hover:
          "hover:border-[#E2C08A] hover:bg-[#FFF3E4] hover:shadow-md hover:-translate-y-0.5",
        dot: "bg-[#A87532]",
        badge: "bg-[#FFF3E4] text-[#A87532]",
        iconWrap: "bg-[#FFF3E4] text-[#A87532]",
        markRead: "text-[#A87532] hover:text-[#8F6329]",
      };
    case "task_assigned":
      return {
        label: "Task assigned",
        icon: ClipboardList,
        unread: "border-[#C5D9F0] bg-[#F5F9FD]",
        read: "border-[#E9EFF1] bg-white",
        hover:
          "hover:border-[#9BB8DB] hover:bg-[#EAF1F9] hover:shadow-md hover:-translate-y-0.5",
        dot: "bg-[#3B6EA5]",
        badge: "bg-[#EAF1F9] text-[#3B6EA5]",
        iconWrap: "bg-[#EAF1F9] text-[#3B6EA5]",
        markRead: "text-[#3B6EA5] hover:text-[#2F587F]",
      };
    case "task_completed":
      return {
        label: "Task completed",
        icon: CheckCircle2,
        unread: "border-[#BFE6DF] bg-[#F3FBFA]",
        read: "border-[#E9EFF1] bg-white",
        hover:
          "hover:border-[#8FCFC4] hover:bg-[#EAF7F4] hover:shadow-md hover:-translate-y-0.5",
        dot: "bg-[#0E9384]",
        badge: "bg-[#EAF7F4] text-[#0E9384]",
        iconWrap: "bg-[#EAF7F4] text-[#0E9384]",
        markRead: "text-[#0E9384] hover:text-[#087A6D]",
      };
    case "task_overdue":
      return {
        label: "Task overdue",
        icon: Clock3,
        unread: "border-[#F0C9C4] bg-[#FFF8F7]",
        read: "border-[#E9EFF1] bg-white",
        hover:
          "hover:border-[#E5A79F] hover:bg-[#FFF1EF] hover:shadow-md hover:-translate-y-0.5",
        dot: "bg-[#A64D43]",
        badge: "bg-[#FFF1EF] text-[#A64D43]",
        iconWrap: "bg-[#FFF1EF] text-[#A64D43]",
        markRead: "text-[#A64D43] hover:text-[#8B3D35]",
      };
    case "role_changed":
      return {
        label: "Role update",
        icon: UserCog,
        unread: "border-[#D5DEE8] bg-[#F7F9FB]",
        read: "border-[#E9EFF1] bg-white",
        hover:
          "hover:border-[#B7C4D0] hover:bg-[#EEF2F5] hover:shadow-md hover:-translate-y-0.5",
        dot: "bg-[#486170]",
        badge: "bg-[#EEF2F5] text-[#486170]",
        iconWrap: "bg-[#EEF2F5] text-[#486170]",
        markRead: "text-[#486170] hover:text-[#294354]",
      };
    case "work_update_reminder":
      return {
        label: "Reminder",
        icon: Clock3,
        unread: "border-[#F0D9B8] bg-[#FFF9F1]",
        read: "border-[#E9EFF1] bg-white",
        hover:
          "hover:border-[#E2C08A] hover:bg-[#FFF3E4] hover:shadow-md hover:-translate-y-0.5",
        dot: "bg-[#A87532]",
        badge: "bg-[#FFF3E4] text-[#A87532]",
        iconWrap: "bg-[#FFF3E4] text-[#A87532]",
        markRead: "text-[#A87532] hover:text-[#8F6329]",
      };
    case "punch_out_correction_approved":
    case "punch_in_correction_approved":
      return {
        label: "Correction approved",
        icon: CheckCircle2,
        unread: "border-[#BFE6DF] bg-[#F3FBFA]",
        read: "border-[#E9EFF1] bg-white",
        hover:
          "hover:border-[#8FCFC4] hover:bg-[#EAF7F4] hover:shadow-md hover:-translate-y-0.5",
        dot: "bg-[#0E9384]",
        badge: "bg-[#EAF7F4] text-[#0E9384]",
        iconWrap: "bg-[#EAF7F4] text-[#0E9384]",
        markRead: "text-[#0E9384] hover:text-[#087A6D]",
      };
    case "punch_out_correction_rejected":
    case "punch_in_correction_rejected":
      return {
        label: "Correction rejected",
        icon: XCircle,
        unread: "border-[#F0C9C4] bg-[#FFF8F7]",
        read: "border-[#E9EFF1] bg-white",
        hover:
          "hover:border-[#E5A79F] hover:bg-[#FFF1EF] hover:shadow-md hover:-translate-y-0.5",
        dot: "bg-[#A64D43]",
        badge: "bg-[#FFF1EF] text-[#A64D43]",
        iconWrap: "bg-[#FFF1EF] text-[#A64D43]",
        markRead: "text-[#A64D43] hover:text-[#8B3D35]",
      };
    case "punch_out_correction_requested":
    case "punch_in_correction_requested":
    case "punch_out_manual":
      return {
        label:
          type === "punch_out_manual" ? "Manual punch-out" : "Correction request",
        icon: Shield,
        unread: "border-[#F0D9B8] bg-[#FFF9F1]",
        read: "border-[#E9EFF1] bg-white",
        hover:
          "hover:border-[#E2C08A] hover:bg-[#FFF3E4] hover:shadow-md hover:-translate-y-0.5",
        dot: "bg-[#A87532]",
        badge: "bg-[#FFF3E4] text-[#A87532]",
        iconWrap: "bg-[#FFF3E4] text-[#A87532]",
        markRead: "text-[#A87532] hover:text-[#8F6329]",
      };
    default:
      return {
        label: "Update",
        icon: Bell,
        unread: "border-[#D8ECE8] bg-[#F7FCFA]",
        read: "border-[#E9EFF1] bg-white",
        hover:
          "hover:border-[#8FCFC4] hover:bg-[#EAF7F4] hover:shadow-md hover:-translate-y-0.5",
        dot: "bg-[#0E9384]",
        badge: "bg-[#EAF7F4] text-[#0E9384]",
        iconWrap: "bg-[#EAF7F4] text-[#0E9384]",
        markRead: "text-[#0E9384] hover:text-[#087A6D]",
      };
  }
}

/** Split rejection body so the reason can be shown on its own highlighted line. */
function splitNotificationBody(type: string, body: string) {
  const isRejection =
    type === "leave_rejected" ||
    type === "punch_out_correction_rejected" ||
    type === "punch_in_correction_rejected";

  if (!isRejection) {
    return { summary: body, reason: null as string | null };
  }

  const reasonLabelMatch = body.match(/^(.*?)\nReason:\s*([\s\S]+)$/);
  if (reasonLabelMatch) {
    return {
      summary: reasonLabelMatch[1].trim(),
      reason: reasonLabelMatch[2].trim() || null,
    };
  }

  const marker = " was rejected.";
  const idx = body.indexOf(marker);
  if (idx === -1) {
    return { summary: body, reason: null as string | null };
  }

  const summary = body.slice(0, idx + marker.length).trim();
  const reason = body.slice(idx + marker.length).trim();
  return { summary, reason: reason || null };
}

function toDrawerItem(notification: {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string | Date;
  type: string;
  resource?: NotificationItem["resource"];
  workDate?: string | null;
}): NotificationItem {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    isRead: notification.isRead,
    createdAt:
      typeof notification.createdAt === "string"
        ? notification.createdAt
        : notification.createdAt.toISOString(),
    type: notification.type,
    resource: notification.resource ?? null,
    workDate: notification.workDate ?? null,
  };
}

export function NotificationDrawer({
  onClose,
  onMarkRead,
  viewerRole,
  viewerUserId,
}: {
  onClose: () => void;
  onMarkRead: (id?: string) => void | Promise<void>;
  viewerRole: Role;
  viewerUserId: string;
}) {
  const router = useRouter();
  const listQuery = useInfiniteNotifications(viewerUserId, true);
  const deleteMutation = useDeleteNotification();
  const clearAllMutation = useClearAllNotifications();
  const [markingAll, setMarkingAll] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const notifications = useMemo(() => {
    const pages = listQuery.data?.pages ?? [];
    return pages.flatMap((page) => page.notifications.map(toDrawerItem));
  }, [listQuery.data?.pages]);

  const hasUnread = notifications.some((notification) => !notification.isRead);
  const isBusy =
    deleteMutation.isPending || clearAllMutation.isPending || markingAll;

  useEffect(() => {
    const root = scrollRef.current;
    const node = loadMoreRef.current;
    if (!root || !node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((entry) => entry.isIntersecting) &&
          listQuery.hasNextPage &&
          !listQuery.isFetchingNextPage
        ) {
          void listQuery.fetchNextPage();
        }
      },
      { root, rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [
    listQuery.hasNextPage,
    listQuery.isFetchingNextPage,
    listQuery.fetchNextPage,
    notifications.length,
  ]);

  async function onDelete(id: string) {
    await deleteMutation.mutateAsync(id);
  }

  async function onClearAll() {
    await clearAllMutation.mutateAsync();
  }

  async function onMarkAllRead() {
    setMarkingAll(true);
    try {
      await onMarkRead();
    } finally {
      setMarkingAll(false);
    }
  }

  function openRelatedPage(notification: NotificationItem) {
    if (!notification.isRead) {
      onMarkRead(notification.id);
    }
    const href = notificationHref(notification.type, viewerRole);
    onClose();
    router.push(href as Parameters<typeof router.push>[0]);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#173247]/20 backdrop-blur-[1px]"
      onMouseDown={onClose}
    >
      <aside
        onMouseDown={(event) => event.stopPropagation()}
        className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col overflow-hidden bg-white shadow-2xl"
      >
        <BusyOverlay
          active={clearAllMutation.isPending || markingAll}
          label={
            clearAllMutation.isPending
              ? "Clearing notifications…"
              : "Marking as read…"
          }
        />
        <div className="flex items-center justify-between border-b border-[#E5EDF0] p-5">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#0E9384]">
              Signal center
            </p>
            <h2 className="mt-1 text-lg font-extrabold">Notifications</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#6C8291] hover:bg-[#F3F7F8]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {(hasUnread || notifications.length > 0) && (
          <div className="mx-5 mt-4 flex items-center justify-between gap-3">
            {hasUnread ? (
              <button
                type="button"
                aria-label="Mark all notifications as read"
                disabled={isBusy}
                onClick={() => void onMarkAllRead()}
                className="text-xs font-extrabold text-[#0E9384] hover:text-[#087A6D] disabled:opacity-50"
              >
                Mark all as read
              </button>
            ) : (
              <span />
            )}
            {notifications.length > 0 ? (
              <button
                type="button"
                aria-label="Clear all notifications"
                title="Clear all"
                disabled={isBusy}
                onClick={() => void onClearAll()}
                className="text-xs font-extrabold text-[#A64D43] hover:text-[#8B3D35] disabled:opacity-50"
              >
                Clear all
              </button>
            ) : null}
          </div>
        )}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5">
          {listQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs font-semibold text-[#8B9BA6]">
              <LoaderCircle className="h-4 w-4 animate-spin text-[#0E9384]" />
              Loading notifications…
            </div>
          ) : notifications.length ? (
            <div className="space-y-3">
              {notifications.map((notification) => {
                const tone = notificationTone(notification.type);
                const Icon = tone.icon;
                const { summary, reason } = splitNotificationBody(
                  notification.type,
                  notification.body,
                );
                const destination = notificationHref(
                  notification.type,
                  viewerRole,
                );
                return (
                  <article
                    key={notification.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`Open ${tone.label}: ${notification.title}`}
                    title={`Open ${destination.replace("/dashboard/", "").replace(/-/g, " ")}`}
                    onClick={() => openRelatedPage(notification)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openRelatedPage(notification);
                      }
                    }}
                    className={`cursor-pointer rounded-xl border p-3.5 transition duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9384]/35 ${
                      notification.isRead ? tone.read : tone.unread
                    } ${tone.hover}`}
                  >
                    <div className="flex gap-3">
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone.iconWrap}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] ${tone.badge}`}
                            >
                              {!notification.isRead ? (
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${tone.dot}`}
                                />
                              ) : null}
                              {tone.label}
                            </span>
                          </div>
                          <button
                            type="button"
                            aria-label="Delete notification"
                            title="Delete"
                            disabled={isBusy}
                            onClick={(event) => {
                              event.stopPropagation();
                              void onDelete(notification.id);
                            }}
                            className="shrink-0 rounded-md p-1 text-[#92A1AA] transition hover:bg-[#FFF1EF] hover:text-[#A64D43] disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="mt-1.5 text-xs font-extrabold text-[#294354]">
                          {notification.title}
                        </p>
                        <p className="mt-1 text-xs font-medium leading-5 text-[#708494]">
                          {summary}
                        </p>
                        {reason ? (
                          <div className="mt-2 rounded-lg border border-[#F0C9C4] bg-[#FFF1EF] px-2.5 py-2">
                            <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#A64D43]">
                              Reason
                            </p>
                            <p className="mt-1 text-xs font-semibold leading-5 text-[#8B3D35]">
                              {reason}
                            </p>
                          </div>
                        ) : null}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold text-[#92A1AA]">
                            {formatDateNumeric(notification.createdAt)}
                          </span>
                          {!notification.isRead && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onMarkRead(notification.id);
                              }}
                              className={`text-[10px] font-extrabold ${tone.markRead}`}
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
              <div ref={loadMoreRef} className="h-4 w-full" />
              {listQuery.isFetchingNextPage ? (
                <div className="flex items-center justify-center gap-2 py-3 text-[11px] font-semibold text-[#8B9BA6]">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[#0E9384]" />
                  Loading more…
                </div>
              ) : null}
              {!listQuery.hasNextPage && notifications.length > 0 ? (
                <p className="py-2 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-[#A8B5BD]">
                  End of notifications
                </p>
              ) : null}
            </div>
          ) : (
            <EmptyState
              icon={Bell}
              title="No notifications"
              detail="Task and role activity will appear here as it happens."
            />
          )}
        </div>
      </aside>
    </div>
  );
}
