"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import {
  getTeamMemberDetail,
  getTeamUpdates,
} from "@/features/team/api/team-api";
import type { ListPageQuery } from "@/lib/pagination";

/** Full team updates (no paging) — assignee options / employee lookup. */
export function useTeamUpdates(
  workDate: string,
  enabled: boolean,
  activity: "all" | "active" | "inactive" = "active",
) {
  return useQuery({
    queryKey: queryKeys.team.updates(workDate, activity, null),
    queryFn: async () => (await getTeamUpdates(workDate, activity)).members,
    enabled,
    placeholderData: (previous) => previous,
  });
}

/** Paged team updates table. */
export function useTeamUpdatesPage(
  workDate: string,
  enabled: boolean,
  activity: "all" | "active" | "inactive" = "active",
  page: ListPageQuery,
) {
  return useQuery({
    queryKey: queryKeys.team.updates(workDate, activity, page),
    queryFn: async () => {
      const result = await getTeamUpdates(workDate, activity, page);
      return {
        page: result.page!,
        summary: result.summary ?? {
          submitted: 0,
          total: result.page!.total,
        },
      };
    },
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useEmployeeDetail(
  employeeId: string,
  filters: { range: string; fromDate: string; toDate: string; query: string },
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.team.member(employeeId, filters),
    queryFn: () =>
      getTeamMemberDetail(employeeId, {
        range: filters.range,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        query: filters.query.trim() || undefined,
      }),
    enabled,
  });
}
