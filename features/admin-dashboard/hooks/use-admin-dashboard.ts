"use client";

import { useIsFetching, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import { getAdminDashboard } from "@/features/admin-dashboard/api/admin-dashboard-api";
import { toIndiaMonthKey } from "@/lib/attendance-month";

export function useAdminDashboard(monthKey?: string, enabled = true) {
  const resolvedMonth = monthKey || toIndiaMonthKey();
  return useQuery({
    queryKey: queryKeys.adminDashboard.byMonth(resolvedMonth),
    queryFn: () => getAdminDashboard(resolvedMonth),
    enabled,
    placeholderData: (previous) => previous,
  });
}

/** Workspace header sync indicator for the Dashboard (overview) tab. */
export function useAdminDashboardPageSync(enabled: boolean) {
  const dashboard = useAdminDashboard(undefined, enabled);
  const fetching = useIsFetching({ queryKey: queryKeys.adminDashboard.all });
  return {
    isFetching: enabled && (fetching > 0 || dashboard.isFetching),
    dataUpdatedAt: dashboard.dataUpdatedAt,
  };
}
