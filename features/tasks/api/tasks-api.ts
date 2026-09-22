import { apiRequest } from "@/lib/api/api-client";
import type { EmployeeHistoryRange } from "@/lib/employee-history-rules";
import type { AssignedTask, AssignTaskInput } from "@/types/api.types";

export async function listTasks(params?: {
  developerUserId?: string;
  status?: "pending" | "completed";
  range?: EmployeeHistoryRange;
  fromDate?: string;
  toDate?: string;
}) {
  const search = new URLSearchParams();
  if (params?.developerUserId)
    search.set("developerUserId", params.developerUserId);
  if (params?.status) search.set("status", params.status);
  if (params?.range) search.set("range", params.range);
  if (params?.fromDate) search.set("fromDate", params.fromDate);
  if (params?.toDate) search.set("toDate", params.toDate);
  const query = search.toString();
  return apiRequest<{ tasks: AssignedTask[] }>(
    `/api/tasks${query ? `?${query}` : ""}`
  );
}

export async function assignTask(input: AssignTaskInput) {
  return apiRequest<{ task: AssignedTask }>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function completeTask(taskId: string) {
  return apiRequest<{ task: AssignedTask }>(`/api/tasks/${taskId}`, {
    method: "PATCH",
  });
}

export async function deleteTask(taskId: string) {
  return apiRequest<{ success: boolean }>(`/api/tasks/${taskId}`, {
    method: "DELETE",
  });
}

export async function addTaskRemark(taskId: string, text: string) {
  return apiRequest<{
    remark: { id: string; userName: string; text: string; createdAt: string };
  }>(`/api/tasks/${taskId}/remarks`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}
