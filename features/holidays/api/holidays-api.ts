import { apiRequest } from "@/lib/api/api-client";
import type { CompanyHoliday, CreateHolidayInput } from "@/types/api.types";

export async function listHolidays() {
  return apiRequest<{ holidays: CompanyHoliday[] }>("/api/holidays");
}

export async function createHoliday(input: CreateHolidayInput) {
  return apiRequest<{ holiday: CompanyHoliday }>("/api/holidays", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteHoliday(holidayId: string) {
  return apiRequest<{ deleted: true; id: string }>(
    `/api/holidays/${holidayId}`,
    { method: "DELETE" },
  );
}
