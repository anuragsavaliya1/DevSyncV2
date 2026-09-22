import { apiRequest } from "@/lib/api/api-client";
import type {
  AttendanceReportPayload,
  CreateAttendanceReportEntryInput,
  UpdateAttendanceReportEntryInput,
} from "@/types/api.types";

export type AttendanceReportQueryInput = {
  month?: string;
  fromMonth?: string;
  toMonth?: string;
  employeeId?: string | null;
};

export async function getAttendanceReport(
  input: string | AttendanceReportQueryInput,
) {
  const params = new URLSearchParams();
  if (typeof input === "string") {
    params.set("month", input);
  } else {
    const fromMonth = input.fromMonth || input.month;
    const toMonth = input.toMonth || input.fromMonth || input.month;
    if (fromMonth) params.set("fromMonth", fromMonth);
    if (toMonth) params.set("toMonth", toMonth);
    if (input.month && !input.fromMonth) params.set("month", input.month);
    if (input.employeeId) params.set("employeeId", input.employeeId);
  }
  return apiRequest<AttendanceReportPayload>(
    `/api/attendance-reports?${params.toString()}`,
  );
}

export async function createAttendanceReportEntry(
  input: CreateAttendanceReportEntryInput,
) {
  return apiRequest<AttendanceReportPayload>("/api/attendance-reports", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateAttendanceReportEntry(
  input: UpdateAttendanceReportEntryInput,
) {
  return apiRequest<AttendanceReportPayload>("/api/attendance-reports", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteAttendanceReportEntry(month: string, id: string) {
  const params = new URLSearchParams({ month, id });
  return apiRequest<AttendanceReportPayload>(
    `/api/attendance-reports?${params.toString()}`,
    { method: "DELETE" },
  );
}
