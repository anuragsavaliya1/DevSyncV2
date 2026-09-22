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
import { invalidateHolidays } from "@/lib/query/invalidate";
import type { CreateHolidayInput } from "@/types/api.types";

export function useHolidays(enabled = true) {
  return useQuery({
    queryKey: queryKeys.holidays.list,
    queryFn: async () => (await listHolidays()).holidays,
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
