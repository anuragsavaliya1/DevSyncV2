import { apiRequest } from "@/lib/api/api-client";
import {
  appendListPageParams,
  normalizePaginatedList,
  type ListPageQuery,
} from "@/lib/pagination";
import type { CompanyHoliday, CreateHolidayInput } from "@/types/api.types";

export type HolidaysListFilters = {
  range?: "upcoming" | "past" | "all";
  asOf?: string;
  page?: ListPageQuery | null;
};

export async function listHolidays(filters?: HolidaysListFilters) {
  const params = new URLSearchParams();
  if (filters?.range && filters.range !== "all") {
    params.set("range", filters.range);
  }
  if (filters?.asOf) params.set("asOf", filters.asOf);
  appendListPageParams(params, filters?.page);
  const query = params.toString();
  const data = await apiRequest<{
    holidays: CompanyHoliday[];
    total?: number;
    start?: number;
    limit?: number;
  }>(`/api/holidays${query ? `?${query}` : ""}`);
  if (!filters?.page) return { holidays: data.holidays };
  return {
    holidays: data.holidays,
    page: normalizePaginatedList(data.holidays, data, filters.page),
  };
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
