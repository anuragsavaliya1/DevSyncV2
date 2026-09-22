import { apiRequest } from "@/lib/api/api-client";
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

export async function getMyLeaveRequests() {
  return apiRequest<{ requests: LeaveRequest[] }>("/api/leave?scope=mine");
}

export async function getLeaveRequestsForReview(status?: LeaveStatus | "all") {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const query = params.toString();
  return apiRequest<{ requests: LeaveRequest[] }>(
    `/api/leave${query ? `?${query}` : ""}`,
  );
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
