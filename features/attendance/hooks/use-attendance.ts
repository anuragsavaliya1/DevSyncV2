"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import {
  getAttendance,
  getAttendanceMonth,
  getTeamAttendance,
  punch,
} from "@/features/attendance/api/attendance-api";
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

export function useTeamAttendance(
  workDate: string,
  enabled: boolean,
  activity: "all" | "active" | "inactive" = "active",
) {
  return useQuery({
    queryKey: queryKeys.attendance.team(workDate, activity),
    queryFn: async () => (await getTeamAttendance(workDate, activity)).rows,
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
