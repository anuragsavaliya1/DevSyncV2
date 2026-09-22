"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import {
  addTaskRemark,
  assignTask,
  completeTask,
  deleteTask,
  listTasks,
} from "@/features/tasks/api/tasks-api";
import type { EmployeeHistoryRange } from "@/lib/employee-history-rules";
import {
  invalidateTaskRelated,
  invalidateTasks,
  invalidateTeam,
} from "@/lib/query/invalidate";
import type { AssignTaskInput } from "@/types/api.types";

export function useTasks(
  enabled = true,
  filters?: {
    status?: "pending" | "completed";
    range?: EmployeeHistoryRange;
  },
) {
  return useQuery({
    queryKey: queryKeys.tasks.list(filters),
    queryFn: async () => (await listTasks(filters)).tasks,
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useAssignTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignTaskInput) => assignTask(input),
    onSuccess: async () => {
      await invalidateTaskRelated(queryClient);
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => completeTask(taskId),
    onSuccess: async () => {
      await Promise.all([
        invalidateTasks(queryClient),
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.all,
        }),
      ]);
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: async () => {
      await Promise.all([
        invalidateTasks(queryClient),
        invalidateTeam(queryClient),
      ]);
    },
  });
}

export function useAddTaskRemark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, text }: { taskId: string; text: string }) =>
      addTaskRemark(taskId, text),
    onSuccess: async () => {
      await Promise.all([
        invalidateTasks(queryClient),
        invalidateTeam(queryClient),
      ]);
    },
  });
}
