import { apiRequest } from "@/lib/api/api-client";
import type { EmployeeHistoryRange } from "@/lib/employee-history-rules";
import type { SaveWorkUpdateInput, WorkUpdate } from "@/types/api.types";

export async function listWorkUpdates(params?: {
  userId?: string;
  workDate?: string;
  range?: EmployeeHistoryRange;
  fromDate?: string;
  toDate?: string;
}) {
  const search = new URLSearchParams();
  if (params?.userId) search.set("userId", params.userId);
  if (params?.workDate) search.set("workDate", params.workDate);
  if (params?.range) search.set("range", params.range);
  if (params?.fromDate) search.set("fromDate", params.fromDate);
  if (params?.toDate) search.set("toDate", params.toDate);
  const query = search.toString();
  return apiRequest<{ updates: WorkUpdate[] }>(
    `/api/work-updates${query ? `?${query}` : ""}`
  );
}

export async function saveWorkUpdate(input: SaveWorkUpdateInput) {
  return apiRequest<{ update: WorkUpdate }>("/api/work-updates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
