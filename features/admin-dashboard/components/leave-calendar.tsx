"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  buildCalendarGrid,
  isIndiaWeekend,
  shiftMonthKey,
} from "@/lib/attendance-month";
import { leavesCoveringDate } from "@/lib/admin-dashboard-rules";
import type { AdminDashboardLeaveRow } from "@/types/api.types";
import { formatDate } from "@/features/workspace/utils/format";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const NAMES_VISIBLE = 3;

type CalendarHoliday = {
  id: string;
  date: string;
  name: string;
  kind: "holiday" | "weekoff";
};

function leaveChipText(leave: AdminDashboardLeaveRow) {
  const name = shortName(leave.employeeName);
  return leave.dayPortion === "full"
    ? name
    : `${name} · ${leave.durationLabel}`;
}

function leaveTitle(leave: AdminDashboardLeaveRow) {
  const parts = [
    leave.employeeName,
    leave.leaveTypeLabel,
    leave.durationLabel,
  ];
  if (leave.reason) parts.push(leave.reason);
  return parts.join(" · ");
}

function monthTitle(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 10);
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function DayOverflowMenu({
  date,
  hiddenLeaves,
  open,
  onToggle,
}: {
  date: string;
  hiddenLeaves: AdminDashboardLeaveRow[];
  open: boolean;
  onToggle: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        onToggle();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, onToggle]);

  return (
    <div ref={menuRef} className="group/overflow relative z-20">
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${hiddenLeaves.length} more employees on leave`}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className="mt-0.5 w-full truncate rounded-md bg-[#0E9384]/18 px-1 py-0.5 text-left text-[9px] font-extrabold leading-tight text-[#0A7D71] hover:bg-[#0E9384]/28"
      >
        +{hiddenLeaves.length} more
      </button>
      <div
        className={`absolute left-0 right-0 top-full z-30 mt-1 min-w-[9.5rem] rounded-xl border border-[#D7EEE9] bg-white p-2 shadow-[0_12px_28px_rgba(16,42,58,0.14)] ${
          open ? "block" : "hidden group-hover/overflow:block"
        }`}
        role="list"
      >
        <p className="mb-1.5 px-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
          Also on leave · {formatDate(date)}
        </p>
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {hiddenLeaves.map((leave) => (
            <li
              key={`${leave.id}-overflow-${date}`}
              className="rounded-lg bg-[#F3FBFA] px-2 py-1.5"
            >
              <p className="truncate text-[10px] font-extrabold text-[#294354]">
                {leave.employeeName}
              </p>
              <p className="truncate text-[9px] font-medium text-[#617687]">
                {leave.leaveTypeLabel} · {leave.durationLabel}
                {leave.reason ? ` · ${leave.reason}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function dayCellTone(input: {
  isSelected: boolean;
  isSunday: boolean;
  holiday: CalendarHoliday | null;
  hasLeave: boolean;
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
  if (input.hasLeave) {
    return "border-[#A9CBE6] bg-[#EEF6FC] hover:border-[#7EAFD4]";
  }
  return "border-[#EEF3F5] bg-[#FBFCFD] hover:border-[#E5EDF0] hover:bg-white";
}

export function AdminLeaveCalendar({
  monthKey,
  todayDate,
  leaves,
  holidays = [],
  onMonthChange,
}: {
  monthKey: string;
  todayDate: string;
  leaves: AdminDashboardLeaveRow[];
  holidays?: CalendarHoliday[];
  onMonthChange: (next: string) => void;
}) {
  const cells = useMemo(() => buildCalendarGrid(monthKey), [monthKey]);
  const holidayByDate = useMemo(() => {
    const map = new Map<string, CalendarHoliday>();
    for (const holiday of holidays) map.set(holiday.date, holiday);
    return map;
  }, [holidays]);
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [overflowDate, setOverflowDate] = useState<string | null>(null);
  const selectedLeaves = selectedDate
    ? leavesCoveringDate(leaves, selectedDate, holidayByDate)
    : [];
  const selectedHoliday = selectedDate
    ? holidayByDate.get(selectedDate) ?? null
    : null;
  const selectedIsSunday = selectedDate ? isIndiaWeekend(selectedDate) : false;

  return (
    <section className="rounded-2xl border border-[#E1EAED] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#294354]">
            Leave calendar
          </h3>
          <p className="mt-0.5 text-[11px] font-medium text-[#8B9BA6]">
            Leaves, Sundays, week offs, and holidays
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onMonthChange(shiftMonthKey(monthKey, -1))}
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
            onClick={() => onMonthChange(shiftMonthKey(monthKey, 1))}
            className="rounded-lg border border-[#E5EDF0] p-1.5 text-[#486170] hover:bg-[#F7FAFB]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
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
              const dayLeaves = leavesCoveringDate(
                leaves,
                cell.date,
                holidayByDate,
              );
              const holiday = holidayByDate.get(cell.date) ?? null;
              const isSunday = isIndiaWeekend(cell.date);
              const hasLeave = dayLeaves.length > 0;
              const isSelected = selectedDate === cell.date;
              const visible = dayLeaves.slice(0, NAMES_VISIBLE);
              const hidden = dayLeaves.slice(NAMES_VISIBLE);

              return (
                <div
                  key={cell.date}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedDate(cell.date);
                    setOverflowDate(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedDate(cell.date);
                      setOverflowDate(null);
                    }
                  }}
                  className={`relative flex min-h-[7rem] min-w-[118px] cursor-pointer flex-col rounded-xl border px-1.5 py-1.5 text-left transition sm:min-h-[7.75rem] sm:px-2 sm:py-2 ${dayCellTone(
                    {
                      isSelected,
                      isSunday,
                      holiday,
                      hasLeave,
                    },
                  )} ${cell.inMonth ? "" : "opacity-45"}`}
                >
                  <span
                    className={`text-[11px] font-extrabold ${
                      !cell.inMonth
                        ? "text-[#B7C4CC]"
                        : isSunday || holiday?.kind === "weekoff"
                          ? "text-[#A64D43]"
                          : holiday?.kind === "holiday"
                            ? "text-[#9A5B1F]"
                            : hasLeave
                              ? "text-[#2F6B9A]"
                              : "text-[#294354]"
                    }`}
                  >
                    {Number(cell.date.slice(8, 10))}
                  </span>
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
                    {visible.map((leave) => (
                      <span
                        key={`${leave.id}-${cell.date}`}
                        className="truncate rounded-md bg-[#0E9384]/12 px-1 py-0.5 text-[9px] font-bold leading-tight text-[#0A7D71]"
                        title={leaveTitle(leave)}
                      >
                        {leaveChipText(leave)}
                      </span>
                    ))}
                    {hidden.length > 0 ? (
                      <DayOverflowMenu
                        date={cell.date}
                        hiddenLeaves={hidden}
                        open={overflowDate === cell.date}
                        onToggle={() =>
                          setOverflowDate((current) =>
                            current === cell.date ? null : cell.date,
                          )
                        }
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[#E5EDF0] bg-[#FBFCFD] px-3 py-3">
        {selectedDate ? (
          <div className="space-y-3">
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
            {selectedLeaves.length ? (
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8B9BA6]">
                  On leave · {formatDate(selectedDate)}
                </p>
                <ul className="mt-2 space-y-2">
                  {selectedLeaves.map((leave) => (
                    <li
                      key={`${leave.id}-${selectedDate}`}
                      className="rounded-lg border border-[#E5EDF0] bg-white px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#486170]">
                        <span className="font-extrabold text-[#294354]">
                          {leave.employeeName}
                        </span>
                        <span className="text-[#8B9BA6]">
                          {leave.leaveTypeLabel} · {leave.durationLabel}
                        </span>
                      </div>
                      {leave.reason ? (
                        <p className="mt-1 text-[11px] font-medium leading-5 text-[#617687]">
                          {leave.reason}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs font-medium text-[#8B9BA6]">
                No employees are on leave for {formatDate(selectedDate)}.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs font-medium text-[#8B9BA6]">
            Select a date to see leave, Sunday, week off, or holiday details.
          </p>
        )}
      </div>
    </section>
  );
}
