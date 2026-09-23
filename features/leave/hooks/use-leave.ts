"use client";

import {
  useIsFetching,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import {
  approveLeaveRequest,
  createLeaveRequest,
  deleteLeaveRequest,
  getLeaveRequestsForReview,
  getLeaveStatusSummary,
  getMyLeaveRequests,
  rejectLeaveRequest,
} from "@/features/leave/api/leave-api";
import type { ListPageQuery } from "@/lib/pagination";
import {
  invalidateAttendance,
  invalidateLeave,
  invalidateNotifications,
} from "@/lib/query/invalidate";
import type {
  CreateLeaveRequestInput,
  LeaveStatus,
  RejectLeaveRequestInput,
} from "@/types/api.types";

async function invalidateLeaveRelated(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  await Promise.all([
    invalidateLeave(queryClient),
    invalidateNotifications(queryClient),
    invalidateAttendance(queryClient),
  ]);
}

/** Full my-leave list (no paging) — used by review dialogs / history helpers. */
export function useMyLeaveRequests(enabled = true) {
  return useQuery({
    queryKey: queryKeys.leave.mine(null),
    queryFn: async () => (await getMyLeaveRequests()).requests,
    enabled,
    placeholderData: (previous) => previous,
  });
}

/** Paged my-leave list for the Leave History table. */
export function useMyLeaveRequestsPage(
  page: ListPageQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.leave.mine(page),
    queryFn: async () => {
      const result = await getMyLeaveRequests(page);
      return {
        page: result.page!,
        counts: result.counts ?? {
          pending: 0,
          approved: 0,
          rejected: 0,
          total: result.page!.total,
        },
      };
    },
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useLeaveRequestsForReview(
  status: LeaveStatus | "all" = "all",
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.leave.list({ status }),
    queryFn: async () => (await getLeaveRequestsForReview(status)).requests,
    enabled,
    placeholderData: (previous) => previous,
  });
}

/** Paged leave review list — fires start/limit on every page change. */
export function useLeaveRequestsForReviewPage(
  status: LeaveStatus | "all",
  page: ListPageQuery,
  options?: { employeeId?: string | null; enabled?: boolean },
) {
  const employeeId = options?.employeeId?.trim() || null;
  const enabled = options?.enabled ?? true;
  return useQuery({
    queryKey: queryKeys.leave.list({
      status,
      employeeId: employeeId ?? undefined,
      start: page.start,
      limit: page.limit,
    }),
    queryFn: async () => {
      const result = await getLeaveRequestsForReview(status, {
        employeeId,
        page,
      });
      return result.page!;
    },
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useLeaveStatusSummary(enabled = true) {
  return useQuery({
    queryKey: queryKeys.leave.summary,
    queryFn: async () => (await getLeaveStatusSummary()).summary,
    enabled,
    placeholderData: (previous) => previous,
  });
}

/** Workspace header sync indicator for the Leave tab. */
export function useLeavePageSync(
  enabled: boolean,
  options?: { canReview?: boolean },
) {
  const canReview = options?.canReview ?? false;
  const mine = useMyLeaveRequests(enabled);
  const summary = useLeaveStatusSummary(enabled && canReview);
  const leaveFetching = useIsFetching({ queryKey: queryKeys.leave.all });
  return {
    isFetching:
      enabled &&
      (leaveFetching > 0 ||
        mine.isFetching ||
        (canReview && summary.isFetching)),
    dataUpdatedAt: Math.max(
      mine.dataUpdatedAt,
      canReview ? summary.dataUpdatedAt : 0,
    ),
  };
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLeaveRequestInput) => createLeaveRequest(input),
    onSuccess: async () => {
      await invalidateLeaveRelated(queryClient);
    },
  });
}

export function useApproveLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => approveLeaveRequest(requestId),
    onSuccess: async () => {
      await invalidateLeaveRelated(queryClient);
    },
  });
}

export function useRejectLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      input,
    }: {
      requestId: string;
      input: RejectLeaveRequestInput;
    }) => rejectLeaveRequest(requestId, input),
    onSuccess: async () => {
      await invalidateLeaveRelated(queryClient);
    },
  });
}

export function useDeleteLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => deleteLeaveRequest(requestId),
    onSuccess: async () => {
      await invalidateLeaveRelated(queryClient);
    },
  });
}
