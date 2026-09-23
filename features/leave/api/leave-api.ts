import { apiRequest } from "@/lib/api/api-client";
import {
  appendListPageParams,
  normalizePaginatedList,
  type ListPageQuery,
  type PaginatedListResult,
} from "@/lib/pagination";
import type {
  CreateLeaveRequestInput,
  LeaveRequest,
  LeaveStatus,
  LeaveStatusSummary,
  RejectLeaveRequestInput,
} from "@/types/api.types";

export async function createLeaveRequest(input: CreateLeaveRequestInput) {
  return apiRequest<{ request: LeaveRequest }>("/api/leave", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getMyLeaveRequests(page?: ListPageQuery | null) {
  const params = new URLSearchParams({ scope: "mine" });
  appendListPageParams(params, page);
  const data = await apiRequest<{
    requests: LeaveRequest[];
    total?: number;
    start?: number;
    limit?: number;
    counts?: {
      pending: number;
      approved: number;
      rejected: number;
      total: number;
    };
  }>(`/api/leave?${params.toString()}`);
  if (!page) return { requests: data.requests, counts: data.counts };
  return {
    requests: data.requests,
    counts: data.counts,
    page: normalizePaginatedList(data.requests, data, page),
  };
}

export async function getLeaveRequestsForReview(
  status?: LeaveStatus | "all",
  options?: {
    employeeId?: string | null;
    page?: ListPageQuery | null;
  },
) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (options?.employeeId) params.set("employeeId", options.employeeId);
  appendListPageParams(params, options?.page);
  const query = params.toString();
  const data = await apiRequest<{
    requests: LeaveRequest[];
    total?: number;
    start?: number;
    limit?: number;
    counts?: {
      pending: number;
      approved: number;
      rejected: number;
      total: number;
    };
  }>(`/api/leave${query ? `?${query}` : ""}`);
  if (!options?.page) return { requests: data.requests, counts: data.counts };
  return {
    requests: data.requests,
    counts: data.counts,
    page: normalizePaginatedList(data.requests, data, options.page),
  };
}

export async function getLeaveStatusSummary() {
  return apiRequest<{ summary: LeaveStatusSummary }>("/api/leave/summary");
}

export async function getLeaveRequest(requestId: string) {
  return apiRequest<{ request: LeaveRequest }>(`/api/leave/${requestId}`);
}

export async function approveLeaveRequest(requestId: string) {
  return apiRequest<{ request: LeaveRequest }>(
    `/api/leave/${requestId}/approve`,
    { method: "POST" },
  );
}

export async function rejectLeaveRequest(
  requestId: string,
  input: RejectLeaveRequestInput,
) {
  return apiRequest<{ request: LeaveRequest }>(
    `/api/leave/${requestId}/reject`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function deleteLeaveRequest(requestId: string) {
  return apiRequest<{ deleted: true; id: string }>(`/api/leave/${requestId}`, {
    method: "DELETE",
  });
}

export type { PaginatedListResult };
