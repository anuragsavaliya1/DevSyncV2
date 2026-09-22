"use client";

import { useMemo } from "react";
import {
  useIsFetching,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import {
  createAttendanceReportEntry,
  deleteAttendanceReportEntry,
  getAttendanceReport,
  updateAttendanceReportEntry,
  type AttendanceReportQueryInput,
} from "@/features/attendance-reports/api/attendance-reports-api";
import { invalidateAttendanceReports } from "@/lib/query/invalidate";
import type {
  CreateAttendanceReportEntryInput,
  UpdateAttendanceReportEntryInput,
} from "@/types/api.types";

export function useAttendanceReport(
  query: AttendanceReportQueryInput | null,
  enabled = true,
) {
  const fromMonth = query?.fromMonth || query?.month || "";
  const toMonth = query?.toMonth || fromMonth;
  const employeeId = query?.employeeId?.trim() || null;

  return useQuery({
    queryKey: queryKeys.attendanceReports.query({
      fromMonth,
      toMonth,
      employeeId,
    }),
    queryFn: () =>
      getAttendanceReport({
        fromMonth,
        toMonth,
        employeeId,
      }),
    enabled: enabled && Boolean(fromMonth && toMonth),
    placeholderData: (previous) => previous,
  });
}

export function useAttendanceReportsPageSync(enabled: boolean) {
  const monthKey = useMemo(() => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(now);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    return `${year}-${month}`;
  }, []);
  const report = useAttendanceReport(
    { fromMonth: monthKey, toMonth: monthKey },
    enabled,
  );
  const fetching = useIsFetching({
    queryKey: queryKeys.attendanceReports.all,
  });
  return {
    isFetching: enabled && (fetching > 0 || report.isFetching),
    dataUpdatedAt: report.dataUpdatedAt,
  };
}

export function useCreateAttendanceReportEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAttendanceReportEntryInput) =>
      createAttendanceReportEntry(input),
    onSuccess: async () => {
      await invalidateAttendanceReports(queryClient);
    },
  });
}

export function useUpdateAttendanceReportEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAttendanceReportEntryInput) =>
      updateAttendanceReportEntry(input),
    onSuccess: async () => {
      await invalidateAttendanceReports(queryClient);
    },
  });
}

export function useDeleteAttendanceReportEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { month: string; id: string }) =>
      deleteAttendanceReportEntry(input.month, input.id),
    onSuccess: async () => {
      await invalidateAttendanceReports(queryClient);
    },
  });
}
