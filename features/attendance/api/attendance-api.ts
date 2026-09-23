import { apiRequest } from "@/lib/api/api-client";
import {
  appendListPageParams,
  normalizePaginatedList,
  type ListPageQuery,
} from "@/lib/pagination";
import type {
  AttendanceMonthLedger,
  AttendanceRecord,
  LeaveDayPortion,
  LeaveType,
  PunchAction,
  WorkspaceUser,
} from "@/types/api.types";

export type TeamAttendanceLeaveInfo = {
  leaveType: LeaveType;
  dayPortion: LeaveDayPortion;
  reason: string;
};

export type TeamAttendanceRow = {
  user: WorkspaceUser;
  attendance: AttendanceRecord | null;
  onLeave: boolean;
  leave: TeamAttendanceLeaveInfo | null;
};

export type TeamAttendanceSummary = {
  present: number;
  onLeave: number;
  absent: number;
  total: number;
};

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
  page?: ListPageQuery | null,
) {
  const params = new URLSearchParams({
    workDate,
    activity,
  });
  appendListPageParams(params, page);
  const data = await apiRequest<{
    workDate: string;
    activity: "all" | "active" | "inactive";
    rows: TeamAttendanceRow[];
    summary?: TeamAttendanceSummary;
    total?: number;
    start?: number;
    limit?: number;
  }>(`/api/team-attendance?${params.toString()}`);
  if (!page) {
    return {
      rows: data.rows,
      summary: data.summary,
    };
  }
  return {
    rows: data.rows,
    summary: data.summary,
    page: normalizePaginatedList(data.rows, data, page),
  };
}
