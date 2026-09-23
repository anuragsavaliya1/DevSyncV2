"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import {
  getAttendance,
  getAttendanceMonth,
  getTeamAttendance,
  punch,
} from "@/features/attendance/api/attendance-api";
import type { ListPageQuery } from "@/lib/pagination";
import { invalidateAttendance } from "@/lib/query/invalidate";
import type { PunchAction } from "@/types/api.types";

export function useAttendance(workDate: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.attendance.byDate(workDate),
    queryFn: async () => (await getAttendance(workDate)).attendance,
    enabled,
  });
}

export function useAttendanceMonth(month: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.attendance.month(month),
    queryFn: async () => (await getAttendanceMonth(month)).ledger,
    enabled,
    placeholderData: (previous) => previous,
  });
}

/** Full team attendance (no paging) — dropdowns / options. */
export function useTeamAttendance(
  workDate: string,
  enabled: boolean,
  activity: "all" | "active" | "inactive" = "active",
) {
  return useQuery({
    queryKey: queryKeys.attendance.team(workDate, activity, null),
    queryFn: async () => (await getTeamAttendance(workDate, activity)).rows,
    enabled,
    placeholderData: (previous) => previous,
  });
}

/** Paged team attendance table — fires start/limit per page. */
export function useTeamAttendancePage(
  workDate: string,
  enabled: boolean,
  activity: "all" | "active" | "inactive" = "active",
  page: ListPageQuery,
) {
  return useQuery({
    queryKey: queryKeys.attendance.team(workDate, activity, page),
    queryFn: async () => {
      const result = await getTeamAttendance(workDate, activity, page);
      return {
        page: result.page!,
        summary: result.summary ?? {
          present: 0,
          onLeave: 0,
          absent: 0,
          total: result.page!.total,
        },
      };
    },
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function usePunch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: PunchAction) => punch(action),
    onSuccess: async () => {
      await invalidateAttendance(queryClient);
    },
  });
}
