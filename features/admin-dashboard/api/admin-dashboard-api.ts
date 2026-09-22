import { apiRequest } from "@/lib/api/api-client";
import type { AdminDashboardPayload } from "@/types/api.types";

export async function getAdminDashboard(monthKey?: string) {
  const params = new URLSearchParams();
  if (monthKey) params.set("month", monthKey);
  const query = params.toString();
  return apiRequest<AdminDashboardPayload>(
    `/api/admin/dashboard${query ? `?${query}` : ""}`,
  );
}
