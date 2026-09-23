import { apiRequest } from "@/lib/api/api-client";
import {
  appendListPageParams,
  normalizePaginatedList,
  type ListPageQuery,
} from "@/lib/pagination";
import type { EmployeeDetail, TeamMember } from "@/types/api.types";

export type TeamUpdatesSummary = {
  submitted: number;
  total: number;
};

export async function getTeamUpdates(
  workDate: string,
  activity: "all" | "active" | "inactive" = "active",
  page?: ListPageQuery | null,
) {
  const params = new URLSearchParams({ workDate, activity });
  appendListPageParams(params, page);
  const data = await apiRequest<{
    workDate: string;
    activity: "all" | "active" | "inactive";
    members: TeamMember[];
    summary?: TeamUpdatesSummary;
    total?: number;
    start?: number;
    limit?: number;
  }>(`/api/team-updates?${params.toString()}`);
  if (!page) {
    return { members: data.members, summary: data.summary };
  }
  return {
    members: data.members,
    summary: data.summary,
    page: normalizePaginatedList(data.members, data, page),
  };
}

export async function getTeamMemberDetail(
  userId: string,
  params: { range?: string; fromDate?: string; toDate?: string; query?: string },
) {
  const search = new URLSearchParams();
  if (params.range) search.set("range", params.range);
  if (params.fromDate) search.set("fromDate", params.fromDate);
  if (params.toDate) search.set("toDate", params.toDate);
  if (params.query) search.set("query", params.query);
  return apiRequest<EmployeeDetail>(
    `/api/team/members/${userId}?${search.toString()}`,
  );
}
