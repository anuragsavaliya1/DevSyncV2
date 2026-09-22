"use client";

import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { QUERY_CONFIG } from "@/constants/query-config";
import { queryKeys } from "@/constants/query-keys";
import { getAttendance } from "@/features/attendance/api/attendance-api";
import { listNotifications } from "@/features/notifications/api/notifications-api";
import { listTasks } from "@/features/tasks/api/tasks-api";
import { listWorkUpdates } from "@/features/work-updates/api/work-updates-api";
import {
  invalidateAdminDashboard,
  invalidateAttendance,
  invalidateAttendanceReports,
  invalidateHolidays,
  invalidateLeave,
  invalidateTaskRelated,
  invalidateTeam,
  invalidateUsers,
  invalidateWorkspaceCore,
} from "@/lib/query/invalidate";
import type { WorkspaceTab } from "@/types/common.types";

/**
 * Orchestrates core workspace server state.
 * Attendance / work updates / tasks: cache + mutation invalidation (no polling).
 * Notifications: selective polling (configurable; future WS/SSE can replace this).
 */
export function useWorkspaceCore(businessDate: string) {
  const results = useQueries({
    queries: [
      {
        queryKey: queryKeys.attendance.byDate(businessDate),
        queryFn: async () => (await getAttendance(businessDate)).attendance,
      },
      {
        queryKey: queryKeys.workUpdates.list(),
        queryFn: async () => (await listWorkUpdates()).updates,
      },
      {
        queryKey: queryKeys.tasks.list(),
        queryFn: async () => (await listTasks()).tasks,
      },
      {
        queryKey: queryKeys.notifications.all,
        queryFn: async () =>
          listNotifications({ limit: QUERY_CONFIG.notifications.pageSize }),
        refetchInterval: QUERY_CONFIG.notifications.refetchInterval,
      },
    ],
  });

  const [attendanceQuery, updatesQuery, tasksQuery, notificationsQuery] =
    results;
  const isLoading = results.some(result => result.isLoading);
  const coreFetching =
    (attendanceQuery.isFetching && !attendanceQuery.isLoading) ||
    (updatesQuery.isFetching && !updatesQuery.isLoading) ||
    (tasksQuery.isFetching && !tasksQuery.isLoading);
  const error = [
    attendanceQuery,
    updatesQuery,
    tasksQuery,
    notificationsQuery,
  ].find(result => result.error)?.error;
  const dataUpdatedAt = Math.max(
    ...results.map(result => result.dataUpdatedAt || 0)
  );

  return {
    attendance: attendanceQuery.data ?? null,
    updates: updatesQuery.data ?? [],
    tasks: tasksQuery.data ?? [],
    notifications: notificationsQuery.data?.notifications ?? [],
    unreadCount: notificationsQuery.data?.unreadCount ?? 0,
    isLoading,
    /** Background refresh of core operational data (excludes notification polling). */
    isFetching: coreFetching,
    error:
      error instanceof Error
        ? error.message
        : error
          ? "Unable to load workspace data."
          : null,
    lastRefreshedAt:
      dataUpdatedAt > 0 ? new Date(dataUpdatedAt).toISOString() : null,
    myUpdatesUpdatedAt: Math.max(
      attendanceQuery.dataUpdatedAt || 0,
      updatesQuery.dataUpdatedAt || 0,
      tasksQuery.dataUpdatedAt || 0
    ),
    attendanceUpdatedAt: attendanceQuery.dataUpdatedAt || 0,
  };
}

/** Manual refresh of core workspace datasets. */
export function useInvalidateWorkspace() {
  const queryClient = useQueryClient();
  return useCallback(() => invalidateWorkspaceCore(queryClient), [queryClient]);
}

/** After assign/remark/archive outside mutation hooks (e.g. employee detail raw API). */
export function useInvalidateTaskRelated() {
  const queryClient = useQueryClient();
  return useCallback(() => invalidateTaskRelated(queryClient), [queryClient]);
}

type RefreshTarget = {
  activeTab: WorkspaceTab;
  hasEmployeeDetail: boolean;
};

/** Refetch only the datasets for the currently open workspace page. */
export function useRefreshActivePage() {
  const queryClient = useQueryClient();
  return useCallback(
    async ({ activeTab, hasEmployeeDetail }: RefreshTarget) => {
      if (hasEmployeeDetail) {
        await invalidateTaskRelated(queryClient);
        return;
      }
      if (activeTab === "my-updates") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.workUpdates.all,
          }),
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
        ]);
        return;
      }
      if (activeTab === "team-updates") {
        await invalidateTeam(queryClient);
        return;
      }
      if (activeTab === "attendance") {
        await invalidateAttendance(queryClient);
        return;
      }
      if (activeTab === "leave") {
        await invalidateLeave(queryClient);
        return;
      }
      if (activeTab === "holidays") {
        await invalidateHolidays(queryClient);
        return;
      }
      if (activeTab === "overview") {
        await invalidateAdminDashboard(queryClient);
        return;
      }
      if (activeTab === "attendance-reports") {
        await invalidateAttendanceReports(queryClient);
        return;
      }
      await invalidateUsers(queryClient);
    },
    [queryClient]
  );
}
