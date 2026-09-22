import { apiRequest } from "@/lib/api/api-client";
import type {
  AttendanceRecord,
  CreatePunchOutCorrectionRequestInput,
  ManualPunchOutInput,
  PunchOutCorrectionRequest,
  RejectPunchOutCorrectionInput,
} from "@/types/api.types";

export async function createPunchOutCorrectionRequest(
  input: CreatePunchOutCorrectionRequestInput,
) {
  return apiRequest<{ request: PunchOutCorrectionRequest }>(
    "/api/attendance/punch-out-requests",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function getMyPunchOutCorrectionRequests(workDate?: string) {
  const params = new URLSearchParams({ scope: "mine" });
  if (workDate) params.set("workDate", workDate);
  return apiRequest<{ requests: PunchOutCorrectionRequest[] }>(
    `/api/attendance/punch-out-requests?${params.toString()}`,
  );
}

export async function getPendingPunchOutCorrectionRequests(workDate?: string) {
  const params = new URLSearchParams();
  if (workDate) params.set("workDate", workDate);
  const query = params.toString();
  return apiRequest<{ requests: PunchOutCorrectionRequest[] }>(
    `/api/attendance/punch-out-requests${query ? `?${query}` : ""}`,
  );
}

export async function approvePunchOutCorrectionRequest(requestId: string) {
  return apiRequest<{
    request: PunchOutCorrectionRequest;
    attendance: AttendanceRecord;
  }>(`/api/attendance/punch-out-requests/${requestId}/approve`, {
    method: "POST",
  });
}

export async function rejectPunchOutCorrectionRequest(
  requestId: string,
  input: RejectPunchOutCorrectionInput,
) {
  return apiRequest<{ request: PunchOutCorrectionRequest }>(
    `/api/attendance/punch-out-requests/${requestId}/reject`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function manualPunchOutEmployee(input: ManualPunchOutInput) {
  return apiRequest<{ attendance: AttendanceRecord }>(
    "/api/attendance/manual-punch-out",
    { method: "POST", body: JSON.stringify(input) },
  );
}
