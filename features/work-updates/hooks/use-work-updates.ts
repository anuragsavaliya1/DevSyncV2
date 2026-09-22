"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import {
  listWorkUpdates,
  saveWorkUpdate,
} from "@/features/work-updates/api/work-updates-api";
import type { EmployeeHistoryRange } from "@/lib/employee-history-rules";
import { invalidateWorkUpdateRelated } from "@/lib/query/invalidate";
import type { SaveWorkUpdateInput } from "@/types/api.types";

export function useWorkUpdates(
  enabled = true,
  filters?: { range?: EmployeeHistoryRange },
) {
  return useQuery({
    queryKey: queryKeys.workUpdates.list(filters),
    queryFn: async () => (await listWorkUpdates(filters)).updates,
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useSaveWorkUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveWorkUpdateInput) => saveWorkUpdate(input),
    onSuccess: async () => {
      await invalidateWorkUpdateRelated(queryClient);
    },
  });
}
