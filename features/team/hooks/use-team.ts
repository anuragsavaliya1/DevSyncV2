"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import {
  getTeamMemberDetail,
  getTeamUpdates,
} from "@/features/team/api/team-api";

/** Team updates — fetch only when the team section is active (no polling). */
export function useTeamUpdates(
  workDate: string,
  enabled: boolean,
  activity: "all" | "active" | "inactive" = "active",
) {
  return useQuery({
    queryKey: queryKeys.team.updates(workDate, activity),
    queryFn: async () => (await getTeamUpdates(workDate, activity)).members,
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useEmployeeDetail(
  employeeId: string,
  filters: { range: string; fromDate: string; toDate: string; query: string },
  enabled = true
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
