/** Attendance summary card for Manager/Admin Employee operations. */
"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { BusyOverlay } from "@/components/shared/action-loader";
import { EmptyState, ErrorState } from "@/components/shared/error-state";
import { useEmployeeAttendanceSummary } from "@/features/team/hooks/use-team";
import {
  formatMonthTitle,
  shiftMonthKey,
} from "@/lib/attendance-month";

function MonthStepper({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex flex-col gap-1">
      <span className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
        {label}
      </span>
      <div className="inline-flex items-center gap-1 rounded-xl border border-[#E5EDF0] bg-[#F7FAFB] px-2 py-1.5">
        <button
          type="button"
          aria-label={`Previous ${label}`}
          disabled={disabled}
          onClick={() => onChange(shiftMonthKey(value, -1))}
          className="rounded-lg p-1 text-[#486170] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[8.5rem] text-center text-xs font-extrabold text-[#294354]">
          {formatMonthTitle(value)}
        </span>
        <button
          type="button"
          aria-label={`Next ${label}`}
          disabled={disabled}
          onClick={() => onChange(shiftMonthKey(value, 1))}
          className="rounded-lg p-1 text-[#486170] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-[#EAF0F2] bg-[#FBFCFD] px-3 py-2.5">
      <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
        {label}
      </p>
      <p className="mt-1 text-lg font-extrabold tabular-nums text-[#173247]">
        {value}
      </p>
    </div>
  );
}

/** Top-bar From/To month controls — Generate appears when draft differs from applied. */
export function EmployeeMonthRangeFilter({
  fromMonth,
  toMonth,
  onFromMonthChange,
  onToMonthChange,
  showGenerate,
  onGenerate,
  generating,
  disabled,
  rangeError,
}: {
  fromMonth: string;
  toMonth: string;
  onFromMonthChange: (next: string) => void;
  onToMonthChange: (next: string) => void;
  showGenerate: boolean;
  onGenerate: () => void;
  generating?: boolean;
  disabled?: boolean;
  rangeError?: string | null;
}) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-end justify-end gap-2">
        <MonthStepper
          label="From"
          value={fromMonth}
          onChange={onFromMonthChange}
          disabled={disabled || generating}
        />
        <MonthStepper
          label="To"
          value={toMonth}
          onChange={onToMonthChange}
          disabled={disabled || generating}
        />
        {showGenerate ? (
          <button
            type="button"
            disabled={Boolean(rangeError) || disabled || generating}
            onClick={onGenerate}
            className="inline-flex h-[2.375rem] items-center justify-center rounded-xl border border-[#B9DCD5] bg-[#F5FBF9] px-4 text-xs font-extrabold text-[#087A6D] transition hover:bg-[#EAF7F4] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? "Generating…" : "Generate data"}
          </button>
        ) : null}
      </div>
      {rangeError ? (
        <p className="max-w-xs text-right text-[10px] font-semibold text-[#A64D43]">
          {rangeError}
        </p>
      ) : null}
    </div>
  );
}

export function EmployeeAttendanceSummaryPanel({
  employeeId,
  fromMonth,
  toMonth,
}: {
  employeeId: string;
  fromMonth: string;
  toMonth: string;
}) {
  const summaryQuery = useEmployeeAttendanceSummary(
    employeeId,
    fromMonth,
    toMonth,
    Boolean(employeeId && fromMonth && toMonth),
  );

  const summary = summaryQuery.data;
  const softBusy =
    summaryQuery.isFetching &&
    Boolean(summaryQuery.data) &&
    !summaryQuery.isLoading;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
      <BusyOverlay active={softBusy} label="Updating attendance…" />
      <div className="border-b border-[#EAF0F2] bg-gradient-to-b from-[#FBFCFD] to-white px-4 py-4 sm:px-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
          Attendance details
        </p>
        <h3 className="mt-1 text-lg font-extrabold tracking-[-0.02em] text-[#173247]">
          Monthly summary
        </h3>
        <p className="mt-1 text-xs font-medium text-[#718494]">
          {summary?.monthLabel ||
            (fromMonth === toMonth
              ? formatMonthTitle(fromMonth)
              : `${formatMonthTitle(fromMonth)} – ${formatMonthTitle(toMonth)}`)}
        </p>
      </div>

      <div className="p-4 sm:p-5">
        {summaryQuery.isLoading && !summary ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className="h-[4.25rem] animate-pulse rounded-xl bg-[#F2F6F7]"
              />
            ))}
          </div>
        ) : summaryQuery.isError ? (
          <ErrorState
            message={
              summaryQuery.error instanceof Error
                ? summaryQuery.error.message
                : "Could not load attendance summary."
            }
          />
        ) : !summary ? (
          <EmptyState
            icon={CalendarDays}
            title="No attendance summary."
            detail="Attendance metrics for this employee will appear here."
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              <StatChip label="Working days" value={summary.workingDays} />
              <StatChip label="Present" value={summary.present} />
              <StatChip label="Late" value={summary.late} />
              <StatChip label="Early" value={summary.early} />
              <StatChip label="Leave" value={summary.leave} />
              <StatChip label="Absent" value={summary.absent} />
              <StatChip label="Missing punch" value={summary.missingPunch} />
            </div>

            {summary.monthSummaries.length > 1 ? (
              <div className="overflow-hidden rounded-xl border border-[#EEF3F5]">
                <div className="border-b border-[#EEF3F5] bg-[#F8FAFB] px-3 py-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#7890A0]">
                    Month breakdown
                  </p>
                </div>
                <div className="divide-y divide-[#EEF3F5]">
                  {summary.monthSummaries.map((row) => (
                    <div
                      key={row.month}
                      className="grid grid-cols-2 gap-2 px-3 py-2.5 text-xs sm:grid-cols-4 lg:grid-cols-8"
                    >
                      <p className="font-extrabold text-[#173247] sm:col-span-1">
                        {row.monthLabel}
                      </p>
                      <p className="text-[#617687]">
                        Working {row.workingDays}
                      </p>
                      <p className="text-[#617687]">Present {row.present}</p>
                      <p className="text-[#617687]">Late {row.late}</p>
                      <p className="text-[#617687]">Early {row.early}</p>
                      <p className="text-[#617687]">Leave {row.leave}</p>
                      <p className="text-[#617687]">Absent {row.absent}</p>
                      <p className="text-[#617687]">
                        Missing {row.missingPunch}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
