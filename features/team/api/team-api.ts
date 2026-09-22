import { apiRequest } from "@/lib/api/api-client";
import type { EmployeeDetail, TeamMember } from "@/types/api.types";

export async function getTeamUpdates(
  workDate: string,
  activity: "all" | "active" | "inactive" = "active",
) {
  const params = new URLSearchParams({ workDate, activity });
  return apiRequest<{
    workDate: string;
    activity: "all" | "active" | "inactive";
    members: TeamMember[];
  }>(`/api/team-updates?${params.toString()}`);
}

export async function getTeamMemberDetail(
  userId: string,
  params: { range?: string; fromDate?: string; toDate?: string; query?: string }
) {
  const search = new URLSearchParams();
  if (params.range) search.set("range", params.range);
  if (params.fromDate) search.set("fromDate", params.fromDate);
  if (params.toDate) search.set("toDate", params.toDate);
  if (params.query) search.set("query", params.query);
  return apiRequest<EmployeeDetail>(
    `/api/team/members/${userId}?${search.toString()}`
  );
}
