import { apiRequest } from "@/lib/api/api-client";
import type {
  AttendanceMonthLedger,
  AttendanceRecord,
  PunchAction,
  WorkspaceUser,
} from "@/types/api.types";

export async function getAttendance(workDate: string) {
  return apiRequest<{ attendance: AttendanceRecord | null }>(
    `/api/attendance?workDate=${workDate}`,
  );
}

export async function getAttendanceMonth(month: string) {
  return apiRequest<{ ledger: AttendanceMonthLedger }>(
    `/api/attendance?month=${encodeURIComponent(month)}`,
  );
}

export async function punch(action: PunchAction) {
  return apiRequest<{ attendance: AttendanceRecord }>("/api/attendance", {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export async function getTeamAttendance(
  workDate: string,
  activity: "all" | "active" | "inactive" = "active",
) {
  const params = new URLSearchParams({
    workDate,
    activity,
  });
  return apiRequest<{
    workDate: string;
    activity: "all" | "active" | "inactive";
    rows: Array<{
      user: WorkspaceUser;
      attendance: AttendanceRecord | null;
      onLeave: boolean;
    }>;
  }>(`/api/team-attendance?${params.toString()}`);
}
