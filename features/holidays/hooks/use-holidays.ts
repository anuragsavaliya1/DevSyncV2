"use client";

import {
  useIsFetching,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import {
  createHoliday,
  deleteHoliday,
  listHolidays,
} from "@/features/holidays/api/holidays-api";
import type { ListPageQuery } from "@/lib/pagination";
import { invalidateHolidays } from "@/lib/query/invalidate";
import type { CreateHolidayInput } from "@/types/api.types";

/** Full holiday list (no paging) — calendars / leave validation. */
export function useHolidays(enabled = true) {
  return useQuery({
    queryKey: queryKeys.holidays.list({}),
    queryFn: async () => (await listHolidays()).holidays,
    enabled,
    placeholderData: (previous) => previous,
  });
}

/** Paged holiday list for upcoming/past tables. */
export function useHolidaysPage(
  filters: {
    range: "upcoming" | "past";
    asOf: string;
    page: ListPageQuery;
  },
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.holidays.list({
      range: filters.range,
      asOf: filters.asOf,
      start: filters.page.start,
      limit: filters.page.limit,
    }),
    queryFn: async () => {
      const result = await listHolidays({
        range: filters.range,
        asOf: filters.asOf,
        page: filters.page,
      });
      return result.page!;
    },
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useHolidaysPageSync(enabled: boolean) {
  const holidays = useHolidays(enabled);
  const fetching = useIsFetching({ queryKey: queryKeys.holidays.all });
  return {
    isFetching: enabled && (fetching > 0 || holidays.isFetching),
    dataUpdatedAt: holidays.dataUpdatedAt,
  };
}

export function useCreateHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHolidayInput) => createHoliday(input),
    onSuccess: async () => {
      await invalidateHolidays(queryClient);
    },
  });
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (holidayId: string) => deleteHoliday(holidayId),
    onSuccess: async () => {
      await invalidateHolidays(queryClient);
    },
  });
}
