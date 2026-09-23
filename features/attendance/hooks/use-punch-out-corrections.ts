"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import {
  approvePunchOutCorrectionRequest,
  createPunchOutCorrectionRequest,
  getMyPunchOutCorrectionRequests,
  getPendingPunchOutCorrectionRequests,
  manualPunchOutEmployee,
  rejectPunchOutCorrectionRequest,
} from "@/features/attendance/api/punch-out-requests-api";
import type { ListPageQuery } from "@/lib/pagination";
import {
  invalidateAttendance,
  invalidateNotifications,
} from "@/lib/query/invalidate";
import type {
  CreatePunchOutCorrectionRequestInput,
  ManualPunchOutInput,
  RejectPunchOutCorrectionInput,
} from "@/types/api.types";

async function invalidatePunchOutRelated(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  await Promise.all([
    invalidateAttendance(queryClient),
    invalidateNotifications(queryClient),
    queryClient.invalidateQueries({
      queryKey: queryKeys.attendance.correctionRequests,
    }),
  ]);
}

export function useMyPunchOutCorrectionRequests(enabled = true) {
  return useQuery({
    queryKey: queryKeys.attendance.myCorrectionRequests,
    queryFn: async () => (await getMyPunchOutCorrectionRequests()).requests,
    enabled,
  });
}

/** Full pending list — used to map pending badges onto team rows. */
export function usePendingPunchOutCorrectionRequests(
  workDate: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.attendance.pendingCorrectionRequests(workDate, null),
    queryFn: async () =>
      (await getPendingPunchOutCorrectionRequests(workDate)).requests,
    enabled,
  });
}

/** Paged pending corrections queue. */
export function usePendingPunchOutCorrectionRequestsPage(
  workDate: string | undefined,
  page: ListPageQuery,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.attendance.pendingCorrectionRequests(workDate, page),
    queryFn: async () => {
      const result = await getPendingPunchOutCorrectionRequests(workDate, page);
      return result.page!;
    },
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useCreatePunchOutCorrectionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePunchOutCorrectionRequestInput) =>
      createPunchOutCorrectionRequest(input),
    onSuccess: async () => {
      await invalidatePunchOutRelated(queryClient);
    },
  });
}

export function useApprovePunchOutCorrectionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) =>
      approvePunchOutCorrectionRequest(requestId),
    onSuccess: async () => {
      await invalidatePunchOutRelated(queryClient);
    },
  });
}

export function useRejectPunchOutCorrectionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      input,
    }: {
      requestId: string;
      input: RejectPunchOutCorrectionInput;
    }) => rejectPunchOutCorrectionRequest(requestId, input),
    onSuccess: async () => {
      await invalidatePunchOutRelated(queryClient);
    },
  });
}

export function useManualPunchOutEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ManualPunchOutInput) => manualPunchOutEmployee(input),
    onSuccess: async () => {
      await invalidatePunchOutRelated(queryClient);
    },
  });
}
