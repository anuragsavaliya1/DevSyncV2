/** Holiday / Sunday / week-off calendar — same visual language as dashboard leave calendar. */
"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  LoaderCircle,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import {
  buildCalendarGrid,
  isIndiaWeekend,
  shiftMonthKey,
  toIndiaMonthKey,
} from "@/lib/attendance-month";
import { formatDate } from "@/features/workspace/utils/format";
import { downloadHolidayCalendarImage } from "@/features/holidays/utils/download-calendar-image";
import type { CompanyHoliday } from "@/types/api.types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CalendarHoliday = {
  id: string;
  date: string;
  name: string;
  kind: "holiday" | "weekoff";
};

function monthTitle(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function dayCellTone(input: {
  isSelected: boolean;
  isSunday: boolean;
  holiday: CalendarHoliday | null;
}) {
  if (input.isSelected) {
    return "border-[#0E9384] bg-[#EAF7F4] shadow-[inset_0_0_0_1px_rgba(14,147,132,0.2)]";
  }
  if (input.isSunday || input.holiday?.kind === "weekoff") {
    return "border-[#F0C9C4] bg-[#FFF5F4] hover:border-[#E8A9A2]";
  }
  if (input.holiday?.kind === "holiday") {
    return "border-[#F0C98A] bg-[#FFF6E8] hover:border-[#E2B56A]";
  }
  return "border-[#EEF3F5] bg-[#FBFCFD] hover:border-[#E5EDF0] hover:bg-white";
}

function HolidayMonthGrid({
  monthKey,
  holidays,
  selectedDate,
  onSelectDate,
}: {
  monthKey: string;
  holidays: CalendarHoliday[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const cells = useMemo(() => buildCalendarGrid(monthKey), [monthKey]);
  const holidayByDate = useMemo(() => {
    const map = new Map<string, CalendarHoliday>();
    for (const holiday of holidays) map.set(holiday.date, holiday);
    return map;
  }, [holidays]);

  return (
    <div className="rounded-2xl bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#294354]">
            Holiday calendar
          </h3>
          <p className="mt-0.5 text-[11px] font-medium text-[#8B9BA6]">
            Sundays, week offs, and holidays · {monthTitle(monthKey)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.08em]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F0C9C4] bg-[#FFF5F4] px-2 py-1 text-[#A64D43]">
            Sunday / Week off
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F0C98A] bg-[#FFF6E8] px-2 py-1 text-[#9A5B1F]">
            Holiday
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[880px]">
          <div className="grid grid-cols-[repeat(7,minmax(118px,1fr))] gap-2">
            {WEEKDAYS.map((day) => (
              <p
                key={day}
                className={`pb-1 text-center text-[9px] font-extrabold uppercase tracking-[0.1em] ${
                  day === "Sun" ? "text-[#A64D43]" : "text-[#8B9BA6]"
                }`}
              >
                {day}
              </p>
            ))}
            {cells.map((cell) => {
              const holiday = holidayByDate.get(cell.date) ?? null;
              const isSunday = isIndiaWeekend(cell.date);
              const isSelected = selectedDate === cell.date;

              return (
                <div
                  key={cell.date}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectDate(cell.date)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectDate(cell.date);
                    }
                  }}
                  className={`relative flex min-h-[7rem] min-w-[118px] cursor-pointer flex-col rounded-xl border px-1.5 py-1.5 text-left transition sm:min-h-[7.75rem] sm:px-2 sm:py-2 ${dayCellTone(
                    { isSelected, isSunday, holiday },
                  )} ${cell.inMonth ? "" : "opacity-45"}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span
                      className={`text-[11px] font-extrabold ${
                        !cell.inMonth
                          ? "text-[#B7C4CC]"
                          : isSunday || holiday?.kind === "weekoff"
                            ? "text-[#A64D43]"
                            : holiday?.kind === "holiday"
                              ? "text-[#9A5B1F]"
                              : "text-[#294354]"
                      }`}
                    >
                      {Number(cell.date.slice(8, 10))}
                    </span>
                  </div>
                  <div className="mt-1 flex min-h-0 flex-1 flex-col gap-0.5">
                    {isSunday ? (
                      <span className="truncate rounded-md bg-[#FFF1EF] px-1 py-0.5 text-[9px] font-extrabold leading-tight text-[#A64D43]">
                        Sunday
                      </span>
                    ) : null}
                    {!isSunday && holiday?.kind === "weekoff" ? (
                      <span
                        className="truncate rounded-md bg-[#FFF1EF] px-1 py-0.5 text-[9px] font-extrabold leading-tight text-[#A64D43]"
                        title={holiday.name}
                      >
                        {holiday.name || "Week off"}
                      </span>
                    ) : null}
                    {!isSunday && holiday?.kind === "holiday" ? (
                      <span
                        className="truncate rounded-md bg-[#FFE9C9] px-1 py-0.5 text-[9px] font-extrabold leading-tight text-[#9A5B1F]"
                        title={holiday.name}
                      >
                        {holiday.name || "Holiday"}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HolidayCalendarDialog({
  businessDate,
  holidays,
  onClose,
}: {
  businessDate: string;
  holidays: CompanyHoliday[];
  onClose: () => void;
}) {
  const initialMonth = toIndiaMonthKey(
    new Date(`${businessDate}T12:00:00+05:30`),
  );
  const [monthKey, setMonthKey] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState(businessDate);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const calendarHolidays: CalendarHoliday[] = useMemo(
    () =>
      holidays.map((holiday) => ({
        id: holiday.id,
        date: holiday.date,
        name: holiday.name,
        kind: holiday.kind === "weekoff" ? "weekoff" : "holiday",
      })),
    [holidays],
  );

  const holidayByDate = useMemo(() => {
    const map = new Map<string, CalendarHoliday>();
    for (const holiday of calendarHolidays) map.set(holiday.date, holiday);
    return map;
  }, [calendarHolidays]);

  const selectedHoliday = holidayByDate.get(selectedDate) ?? null;
  const selectedIsSunday = isIndiaWeekend(selectedDate);

  async function onDownload() {
    setDownloadError(null);
    setDownloading(true);
    try {
      await downloadHolidayCalendarImage({
        monthKey,
        holidays: calendarHolidays,
      });
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : "Could not download calendar image.",
      );
    } finally {
      setDownloading(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#173247]/35 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="holiday-calendar-title"
        className="flex max-h-[min(96dvh,52rem)] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-[#E4ECEF] bg-[#F7FAFB] shadow-2xl sm:rounded-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#EAF0F2] bg-white px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
              Holiday management
            </p>
            <h2
              id="holiday-calendar-title"
              className="mt-0.5 text-base font-extrabold text-[#102A3A]"
            >
              Calendar view
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setMonthKey((current) => shiftMonthKey(current, -1))}
                className="rounded-lg border border-[#E5EDF0] p-1.5 text-[#486170] hover:bg-[#F7FAFB]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="min-w-[9.5rem] text-center text-xs font-extrabold uppercase tracking-[0.08em] text-[#294354]">
                {monthTitle(monthKey)}
              </p>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setMonthKey((current) => shiftMonthKey(current, 1))}
                className="rounded-lg border border-[#E5EDF0] p-1.5 text-[#486170] hover:bg-[#F7FAFB]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              disabled={downloading}
              onClick={() => void onDownload()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D7EEE9] bg-[#F3FBFA] px-3 py-2 text-[11px] font-extrabold text-[#087A6D] hover:bg-[#EAF7F4] disabled:opacity-60"
            >
              {downloading ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Download
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded-lg p-2 text-[#6C8291] hover:bg-[#F3F7F8]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <HolidayMonthGrid
            monthKey={monthKey}
            holidays={calendarHolidays}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />

          <div className="mt-3 rounded-xl border border-[#E5EDF0] bg-white px-3 py-3">
            {(selectedIsSunday || selectedHoliday) && (
              <div
                className={`rounded-lg border px-3 py-2 ${
                  selectedIsSunday || selectedHoliday?.kind === "weekoff"
                    ? "border-[#F0C9C4] bg-[#FFF5F4]"
                    : "border-[#F0C98A] bg-[#FFF6E8]"
                }`}
              >
                <p
                  className={`text-[10px] font-extrabold uppercase tracking-[0.12em] ${
                    selectedIsSunday || selectedHoliday?.kind === "weekoff"
                      ? "text-[#A64D43]"
                      : "text-[#9A5B1F]"
                  }`}
                >
                  {selectedIsSunday
                    ? "Sunday"
                    : selectedHoliday?.kind === "holiday"
                      ? "Holiday"
                      : "Week off"}
                </p>
                <p
                  className={`mt-1 text-xs font-semibold ${
                    selectedIsSunday || selectedHoliday?.kind === "weekoff"
                      ? "text-[#A64D43]"
                      : "text-[#9A5B1F]"
                  }`}
                >
                  {selectedIsSunday
                    ? "Weekly week off"
                    : selectedHoliday?.name ||
                      (selectedHoliday?.kind === "holiday"
                        ? "Company holiday"
                        : "Week off")}
                </p>
              </div>
            )}
            {!selectedIsSunday && !selectedHoliday ? (
              <p className="text-xs font-medium text-[#8B9BA6]">
                No holiday or week off on {formatDate(selectedDate)}.
              </p>
            ) : null}
            {downloadError ? (
              <p className="mt-2 text-xs font-semibold text-[#A64D43]">
                {downloadError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function HolidayCalendarHeaderButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Open holiday calendar"
      title="Holiday calendar"
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#D7EEE9] bg-[#F3FBFA] text-[#0E9384] transition hover:bg-[#EAF7F4]"
    >
      <CalendarDays className="h-4 w-4" />
    </button>
  );
}
