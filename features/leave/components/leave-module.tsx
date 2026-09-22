"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CalendarDays, LoaderCircle, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { BusyOverlay } from "@/components/shared/action-loader";
import { EmptyState, ErrorState } from "@/components/shared/error-state";
import { ThemedSelect } from "@/components/shared/themed-select";
import { useTeamAttendance } from "@/features/attendance/hooks/use-attendance";
import { useHolidays } from "@/features/holidays/hooks/use-holidays";
import {
  useApproveLeaveRequest,
  useCreateLeaveRequest,
  useDeleteLeaveRequest,
  useLeaveRequestsForReview,
  useLeaveStatusSummary,
  useMyLeaveRequests,
  useRejectLeaveRequest,
} from "@/features/leave/hooks/use-leave";
import { AttendanceSkeleton } from "@/features/workspace/components/loading-skeletons";
import {
  formatDate,
  formatDateTime,
} from "@/features/workspace/utils/format";
import { addDaysToDateKey } from "@/lib/attendance-month";
import {
  findLeaveBlockedDays,
  formatLeaveBlockedDaysError,
  isHalfDayPortion,
  isHourlyLeavePortion,
  isPartialDayLeavePortion,
  leaveDayPortionLabel,
  leaveTypeLabel,
  MAX_LEAVE_APPLICATION_DAYS,
  countLeaveCalendarDays,
  selectPreviousLeaveRequests,
  type LeaveHolidayInfo,
} from "@/lib/leave-rules";
import type {
  LeaveDayPortion,
  LeaveRequest,
  LeaveStatus,
  LeaveType,
} from "@/types/api.types";

function statusLabel(status: LeaveStatus) {
  if (status === "pending") return "Pending";
  if (status === "approved") return "Approved";
  return "Rejected";
}

function statusTone(status: LeaveStatus) {
  if (status === "pending") return "text-[#A87532] bg-[#FFF5E7]";
  if (status === "approved") return "text-[#087A6D] bg-[#EAF7F4]";
  return "text-[#A64D43] bg-[#FFF5F4]";
}

function roleLabel(role: string | null | undefined) {
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  if (role === "developer") return "Developer";
  return "—";
}

function dateRangeLabel(startDate: string, endDate: string) {
  if (startDate === endDate) return formatDate(startDate);
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function daysLabel(totalDays: number, dayPortion: LeaveDayPortion = "full") {
  if (isHourlyLeavePortion(dayPortion)) return leaveDayPortionLabel(dayPortion);
  if (isHalfDayPortion(dayPortion) || totalDays === 0.5) return "0.5 day";
  return `${totalDays} day${totalDays === 1 ? "" : "s"}`;
}

function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${statusTone(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function LeavePanelCard({
  title,
  subtitle,
  action,
  busy = false,
  busyLabel = "Updating…",
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  busy?: boolean;
  busyLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
      <BusyOverlay active={busy} label={busyLabel} />
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EAF0F2] bg-gradient-to-b from-[#FBFCFD] to-white px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold tracking-[-0.02em] text-[#173247]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-xs font-medium leading-5 text-[#718494]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function DayPortionRadios({
  value,
  onChange,
  disabled,
}: {
  value: LeaveDayPortion;
  onChange: (value: LeaveDayPortion) => void;
  disabled?: boolean;
}) {
  const durationMode = isHourlyLeavePortion(value)
    ? "other"
    : isHalfDayPortion(value)
      ? "half"
      : "full";
  const halfSession: "first_half" | "second_half" =
    value === "second_half" ? "second_half" : "first_half";
  const hourlyHours: "hours_1" | "hours_2" | "hours_3" =
    value === "hours_2" ? "hours_2" : value === "hours_3" ? "hours_3" : "hours_1";

  return (
    <div className="space-y-3">
      <fieldset className="block">
        <legend className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
          Duration
        </legend>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {(
            [
              { id: "full", label: "Full Day" },
              { id: "half", label: "Half Day" },
              { id: "other", label: "Other" },
            ] as const
          ).map((option) => {
            const selected = durationMode === option.id;
            return (
              <label
                key={option.id}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                  selected
                    ? "border-[#0E9384] bg-[#EAF7F4] text-[#087A6D]"
                    : "border-[#E5EDF0] bg-white text-[#486170] hover:border-[#CBD8DE]"
                } ${disabled ? "pointer-events-none opacity-60" : ""}`}
              >
                <input
                  type="radio"
                  name="leave-day-portion"
                  value={option.id}
                  checked={selected}
                  disabled={disabled}
                  onChange={() =>
                    onChange(
                      option.id === "full"
                        ? "full"
                        : option.id === "half"
                          ? value === "second_half"
                            ? "second_half"
                            : "first_half"
                          : value === "hours_2" || value === "hours_3"
                            ? value
                            : "hours_1",
                    )
                  }
                  className="h-3.5 w-3.5 accent-[#0E9384]"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      {durationMode === "half" ? (
        <fieldset className="block">
          <legend className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
            Half session
          </legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(
              [
                { id: "first_half", label: "1st Half" },
                { id: "second_half", label: "2nd Half" },
              ] as const
            ).map((option) => {
              const selected = halfSession === option.id;
              return (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                    selected
                      ? "border-[#0E9384] bg-[#EAF7F4] text-[#087A6D]"
                      : "border-[#E5EDF0] bg-white text-[#486170] hover:border-[#CBD8DE]"
                  } ${disabled ? "pointer-events-none opacity-60" : ""}`}
                >
                  <input
                    type="radio"
                    name="leave-half-session"
                    value={option.id}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onChange(option.id)}
                    className="h-3.5 w-3.5 accent-[#0E9384]"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {durationMode === "other" ? (
        <fieldset className="block">
          <legend className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
            Hours
          </legend>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {(
              [
                { id: "hours_1", label: "1 hr" },
                { id: "hours_2", label: "2 hr" },
                { id: "hours_3", label: "3 hr" },
              ] as const
            ).map((option) => {
              const selected = hourlyHours === option.id;
              return (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                    selected
                      ? "border-[#0E9384] bg-[#EAF7F4] text-[#087A6D]"
                      : "border-[#E5EDF0] bg-white text-[#486170] hover:border-[#CBD8DE]"
                  } ${disabled ? "pointer-events-none opacity-60" : ""}`}
                >
                  <input
                    type="radio"
                    name="leave-hourly-hours"
                    value={option.id}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onChange(option.id)}
                    className="h-3.5 w-3.5 accent-[#0E9384]"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

function ApplyLeaveDialog({
  onClose,
  mode,
  businessDate,
  allowPastDates,
}: {
  onClose: () => void;
  mode: "self" | "manager";
  businessDate: string;
  /** Admin/Manager may backdate; employees cannot. */
  allowPastDates: boolean;
}) {
  const createMutation = useCreateLeaveRequest();
  const teamAttendance = useTeamAttendance(businessDate, mode === "manager");
  const holidaysQuery = useHolidays(true);
  const [leaveType, setLeaveType] = useState<LeaveType>("casual");
  const [dayPortion, setDayPortion] = useState<LeaveDayPortion>("full");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [managerRemark, setManagerRemark] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState<"pending" | "approved">("approved");
  const [error, setError] = useState<string | null>(null);
  const minDate = allowPastDates ? undefined : businessDate;

  const holidayByDate = useMemo(() => {
    const map = new Map<string, LeaveHolidayInfo>();
    for (const holiday of holidaysQuery.data ?? []) {
      map.set(holiday.date, { kind: holiday.kind, name: holiday.name });
    }
    return map;
  }, [holidaysQuery.data]);

  const employeeOptions = useMemo(() => {
    const rows = teamAttendance.data ?? [];
    return rows
      .map((row) => ({
        value: row.user.id,
        label: row.user.displayName || row.user.email,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [teamAttendance.data]);

  function setPortion(next: LeaveDayPortion) {
    setDayPortion(next);
    if (isPartialDayLeavePortion(next) && startDate) setEndDate(startDate);
  }

  function selectQuickDate(dateKey: string) {
    setStartDate(dateKey);
    setEndDate(dateKey);
  }

  function blockedDaysError(from: string, to: string) {
    // Multi-day leave skips week offs / holidays and keeps working days only.
    if (from !== to) return null;
    return formatLeaveBlockedDaysError(
      findLeaveBlockedDays(from, to, holidayByDate),
    );
  }

  async function submit() {
    setError(null);
    if (mode === "manager" && !employeeId) {
      setError("Select an employee.");
      return;
    }
    if (!startDate || !endDate) {
      setError("From date and to date are required.");
      return;
    }
    const effectiveEnd = isPartialDayLeavePortion(dayPortion) ? startDate : endDate;
    if (startDate > effectiveEnd) {
      setError("From date cannot be after to date.");
      return;
    }
    if (
      countLeaveCalendarDays(startDate, effectiveEnd) > MAX_LEAVE_APPLICATION_DAYS
    ) {
      setError(
        `Leave cannot be applied for more than ${MAX_LEAVE_APPLICATION_DAYS} days.`,
      );
      return;
    }
    if (!allowPastDates && startDate < businessDate) {
      setError("Leave cannot start on a past date.");
      return;
    }
    const nonWorkingError = blockedDaysError(startDate, effectiveEnd);
    if (nonWorkingError) {
      setError(nonWorkingError);
      return;
    }
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    try {
      await createMutation.mutateAsync({
        leaveType,
        dayPortion,
        startDate,
        endDate: effectiveEnd,
        reason,
        ...(mode === "manager"
          ? {
              userId: employeeId,
              status,
              ...(managerRemark.trim()
                ? { managerRemark: managerRemark.trim() }
                : {}),
            }
          : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply for leave.");
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[#102a3a]/35 p-3 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Apply Leave"
        className="relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#E5EDF0] bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <BusyOverlay active={createMutation.isPending} label="Submitting…" />

        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#EAF0F2] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#0E9384]">
              Leave request
            </p>
            <h2 className="mt-1 text-base font-extrabold text-[#102a3a]">
              {mode === "manager" ? "Apply Leave for Employee" : "Apply Leave"}
            </h2>
            <p className="mt-1 text-[11px] font-medium text-[#8294A0]">
              {mode === "manager"
                ? "Record leave directly for a selected employee."
                : "Submit a leave request for manager or admin review."}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8294A0] hover:bg-[#F4F7F9]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {mode === "manager" ? (
            <section className="space-y-3">
   
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block min-w-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
                    Employee
                  </span>
                  <div className="mt-1.5">
                    <ThemedSelect
                      aria-label="Employee"
                      value={employeeId}
                      placeholder="Select employee"
                      onChange={setEmployeeId}
                      options={employeeOptions}
                    />
                  </div>
                </label>
                <label className="block min-w-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
                    Leave Status
                  </span>
                  <div className="mt-1.5">
                    <ThemedSelect
                      aria-label="Leave status"
                      value={status}
                      onChange={(value) =>
                        setStatus(value as "pending" | "approved")
                      }
                      options={[
                        { value: "approved", label: "Approved" },
                        { value: "pending", label: "Pending" },
                      ]}
                    />
                  </div>
                </label>
              </div>
            </section>
          ) : null}

          <section className="space-y-3">

            <div className="">
              <label className="block">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
                  Leave Type
                </span>
                <div className="mt-1.5">
                  <ThemedSelect
                    aria-label="Leave type"
                    value={leaveType}
                    onChange={(value) => setLeaveType(value as LeaveType)}
                    options={[
                      { value: "casual", label: "Casual Leave" },
                      { value: "sick", label: "Sick Leave" },
                      { value: "other", label: "Other" },
                    ]}
                  />
                </div>
              </label>

              <div className="mt-3">
                <DayPortionRadios value={dayPortion} onChange={setPortion} />
              </div>

              <div className="mt-3 block">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
                    Quick date
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {(
                      [
                        { offset: 1, label: "Tomorrow" },
                        { offset: 2, label: "Day after tomorrow" },
                        { offset: 3, label: "In 3 days" },
                      ] as const
                    ).map((option) => {
                      const dateKey = addDaysToDateKey(
                        businessDate,
                        option.offset,
                      );
                      const selected =
                        startDate === dateKey && endDate === dateKey;
                      return (
                        <button
                          key={option.offset}
                          type="button"
                          onClick={() => selectQuickDate(dateKey)}
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-extrabold transition ${
                            selected
                              ? "border-[#0E9384] bg-[#EAF7F4] text-[#087A6D]"
                              : "border-[#E5EDF0] bg-white text-[#486170] hover:border-[#CBD8DE]"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block min-w-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
                    From Date
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    min={minDate}
                    onChange={(event) => {
                      const next = event.target.value;
                      setStartDate(next);
                      if (isPartialDayLeavePortion(dayPortion)) setEndDate(next);
                    }}
                    className="mt-1.5 w-full rounded-xl border border-[#E5EDF0] bg-white px-3 py-2.5 text-sm font-semibold text-[#294354] outline-none focus:border-[#0E9384]"
                  />
                </label>
                <label className="block min-w-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
                    To Date
                  </span>
                  <input
                    type="date"
                    value={
                      isPartialDayLeavePortion(dayPortion) ? startDate : endDate
                    }
                    min={
                      minDate && startDate
                        ? startDate > minDate
                          ? startDate
                          : minDate
                        : startDate || minDate
                    }
                    max={
                      isPartialDayLeavePortion(dayPortion) || !startDate
                        ? undefined
                        : addDaysToDateKey(
                            startDate,
                            MAX_LEAVE_APPLICATION_DAYS - 1,
                          )
                    }
                    disabled={isPartialDayLeavePortion(dayPortion)}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#E5EDF0] bg-white px-3 py-2.5 text-sm font-semibold text-[#294354] outline-none focus:border-[#0E9384] disabled:bg-[#F7FAFB] disabled:text-[#8294A0]"
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="space-y-3">

            <label className="block">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
                Reason
              </span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                className="mt-1.5 w-full resize-none rounded-xl border border-[#E5EDF0] bg-white px-3 py-2.5 text-sm font-medium text-[#294354] outline-none focus:border-[#0E9384]"
                placeholder="Why do you need leave?"
              />
            </label>
            {mode === "manager" ? (
              <label className="block">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
                  Remark
                </span>
                <textarea
                  value={managerRemark}
                  onChange={(event) => setManagerRemark(event.target.value)}
                  rows={2}
                  className="mt-1.5 w-full resize-none rounded-xl border border-[#E5EDF0] bg-white px-3 py-2.5 text-sm font-medium text-[#294354] outline-none focus:border-[#0E9384]"
                  placeholder="Optional manager remark"
                />
              </label>
            ) : null}
          </section>

          {error ? <ErrorState message={error} /> : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[#EAF0F2] bg-white px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3.5 py-2 text-xs font-bold text-[#617687] hover:bg-[#F4F7F9]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => void submit()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0E9384] px-3.5 py-2 text-xs font-extrabold text-white hover:bg-[#0a7d71] disabled:opacity-60"
          >
            {createMutation.isPending ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Apply Leave
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ReviewLeaveDialog({
  request,
  onClose,
  canManage,
}: {
  request: LeaveRequest;
  onClose: () => void;
  canManage: boolean;
}) {
  const approveMutation = useApproveLeaveRequest();
  const rejectMutation = useRejectLeaveRequest();
  const deleteMutation = useDeleteLeaveRequest();
  const reviewHistoryQuery = useLeaveRequestsForReview("all", canManage);
  const myHistoryQuery = useMyLeaveRequests(!canManage);
  const [mode, setMode] = useState<"review" | "reject" | "delete">("review");
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busy =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    deleteMutation.isPending;
  const canReject =
    canManage &&
    (request.status === "pending" || request.status === "approved");
  const canApprove = canManage && request.status === "pending";
  const dayPortion = request.dayPortion ?? "full";

  const historyPool = canManage
    ? (reviewHistoryQuery.data ?? [])
    : (myHistoryQuery.data ?? []);
  const previousLeaves = useMemo(
    () =>
      selectPreviousLeaveRequests(historyPool, {
        userId: request.userId,
        excludeId: request.id,
        limit: 3,
      }),
    [historyPool, request.userId, request.id],
  );
  const historyLoading =
    (canManage && reviewHistoryQuery.isLoading && !reviewHistoryQuery.data) ||
    (!canManage && myHistoryQuery.isLoading && !myHistoryQuery.data);

  async function approve() {
    setError(null);
    try {
      await approveMutation.mutateAsync(request.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve.");
    }
  }

  async function reject() {
    setError(null);
    if (!rejectionReason.trim()) {
      setError("A rejection reason is required.");
      return;
    }
    try {
      await rejectMutation.mutateAsync({
        requestId: request.id,
        input: { rejectionReason },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject.");
    }
  }

  async function remove() {
    setError(null);
    try {
      await deleteMutation.mutateAsync(request.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[#102a3a]/35 p-3 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Leave request"
        className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E5EDF0] bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <BusyOverlay active={busy} label="Updating…" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-[#102a3a]">
              Leave Request
            </h2>
            <p className="mt-1 text-[11px] font-medium text-[#8294A0]">
              {request.employeeName || request.employeeEmail || "Employee"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8294A0] hover:bg-[#F4F7F9]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              Leave Type
            </dt>
            <dd className="mt-1 font-semibold text-[#294354]">
              {leaveTypeLabel(request.leaveType)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              Status
            </dt>
            <dd className="mt-1">
              <LeaveStatusBadge status={request.status} />
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              Duration
            </dt>
            <dd className="mt-1 font-semibold text-[#294354]">
              {leaveDayPortionLabel(dayPortion)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              Total
            </dt>
            <dd className="mt-1 font-semibold text-[#294354]">
              {daysLabel(request.totalDays, dayPortion)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              From
            </dt>
            <dd className="mt-1 font-semibold text-[#294354]">
              {formatDate(request.startDate)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              To
            </dt>
            <dd className="mt-1 font-semibold text-[#294354]">
              {formatDate(request.endDate)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              Reason
            </dt>
            <dd className="mt-1 whitespace-pre-wrap font-medium text-[#486170]">
              {request.reason}
            </dd>
          </div>
          {request.managerRemark ? (
            <div className="sm:col-span-2">
              <dt className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
                Remark
              </dt>
              <dd className="mt-1 whitespace-pre-wrap font-medium text-[#486170]">
                {request.managerRemark}
              </dd>
            </div>
          ) : null}
          {request.status !== "pending" ? (
            <>
              <div>
                <dt className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
                  Reviewed By
                </dt>
                <dd className="mt-1 font-semibold text-[#294354]">
                  {request.reviewedByName || "—"}
                  {request.reviewedByRole
                    ? ` · ${roleLabel(request.reviewedByRole)}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
                  Reviewed At
                </dt>
                <dd className="mt-1 font-semibold text-[#294354]">
                  {formatDateTime(request.reviewedAt)}
                </dd>
              </div>
            </>
          ) : null}
          {request.status === "rejected" && request.rejectionReason ? (
            <div className="sm:col-span-2">
              <dt className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
                Rejection Reason
              </dt>
              <dd className="mt-1 whitespace-pre-wrap font-medium text-[#A64D43]">
                {request.rejectionReason}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-4 rounded-xl border border-[#E5EDF0] bg-[#FBFCFD] px-3 py-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
            Previous leaves
          </p>
          {historyLoading ? (
            <p className="mt-2 text-[11px] font-medium text-[#8B9BA6]">
              Loading history…
            </p>
          ) : previousLeaves.length === 0 ? (
            <p className="mt-2 text-[11px] font-medium text-[#8B9BA6]">
              No earlier leave records for this employee.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {previousLeaves.map((leave) => {
                const portion = leave.dayPortion ?? "full";
                return (
                  <li
                    key={leave.id}
                    className="rounded-lg border border-[#E5EDF0] bg-white px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-extrabold text-[#294354]">
                        {leaveTypeLabel(leave.leaveType)}
                        <span className="font-semibold text-[#617687]">
                          {" "}
                          · {leaveDayPortionLabel(portion)}
                        </span>
                      </p>
                      <LeaveStatusBadge status={leave.status} />
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-[#486170]">
                      {dateRangeLabel(leave.startDate, leave.endDate)}
                      <span className="font-medium text-[#8B9BA6]">
                        {" "}
                        · {daysLabel(leave.totalDays, portion)}
                      </span>
                    </p>
                    {leave.reason ? (
                      <p
                        className="mt-1 line-clamp-2 text-[11px] font-medium leading-4 text-[#617687]"
                        title={leave.reason}
                      >
                        {leave.reason}
                      </p>
                    ) : null}
                    {leave.status === "rejected" && leave.rejectionReason ? (
                      <p
                        className="mt-1 line-clamp-2 text-[10px] font-medium leading-4 text-[#A64D43]"
                        title={leave.rejectionReason}
                      >
                        Rejected: {leave.rejectionReason}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {mode === "reject" ? (
          <label className="mt-4 block">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              Reason for rejection
            </span>
            <textarea
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-xl border border-[#E5EDF0] px-3 py-2.5 text-sm font-medium outline-none focus:border-[#0E9384]"
              placeholder="Explain why this leave is rejected"
            />
          </label>
        ) : null}

        {mode === "delete" ? (
          <p className="mt-4 rounded-xl border border-[#F4C9C4] bg-[#FFF5F4] px-3 py-2.5 text-[12px] font-medium text-[#A64D43]">
            It will disappear from the employee history and calendar without notification.
          </p>
        ) : null}

        {error ? (
          <div className="mt-3">
            <ErrorState message={error} />
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {mode === "review" ? (
            <>
              {canManage ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setMode("delete")}
                  className="mr-auto inline-flex items-center gap-1.5 rounded-xl border border-[#E5EDF0] px-3.5 py-2 text-xs font-extrabold text-[#617687] hover:bg-[#F4F7F9] disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              ) : null}
              {canReject ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setMode("reject")}
                  className="rounded-xl border border-[#F4C9C4] bg-[#FFF5F4] px-3.5 py-2 text-xs font-extrabold text-[#A64D43] disabled:opacity-60"
                >
                  Reject
                </button>
              ) : null}
              {canApprove ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void approve()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0E9384] px-3.5 py-2 text-xs font-extrabold text-white disabled:opacity-60"
                >
                  {approveMutation.isPending ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Approve
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-3.5 py-2 text-xs font-bold text-[#617687] hover:bg-[#F4F7F9]"
                >
                  Close
                </button>
              )}
            </>
          ) : null}
          {mode === "reject" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => setMode("review")}
                className="rounded-xl px-3.5 py-2 text-xs font-bold text-[#617687] hover:bg-[#F4F7F9]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void reject()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#C96B63] px-3.5 py-2 text-xs font-extrabold text-white disabled:opacity-60"
              >
                {rejectMutation.isPending ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Reject Leave
              </button>
            </>
          ) : null}
          {mode === "delete" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => setMode("review")}
                className="rounded-xl px-3.5 py-2 text-xs font-bold text-[#617687] hover:bg-[#F4F7F9]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#C96B63] px-3.5 py-2 text-xs font-extrabold text-white disabled:opacity-60"
              >
                {deleteMutation.isPending ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Delete Leave
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MyLeavePanel({
  canReview,
  businessDate,
}: {
  canReview: boolean;
  businessDate: string;
}) {
  const leaveQuery = useMyLeaveRequests();
  const [showApply, setShowApply] = useState(false);
  const [selected, setSelected] = useState<LeaveRequest | null>(null);

  const requests = leaveQuery.data ?? [];
  const summary = useMemo(() => {
    return {
      pending: requests.filter((item) => item.status === "pending").length,
      approved: requests.filter((item) => item.status === "approved").length,
      rejected: requests.filter((item) => item.status === "rejected").length,
    };
  }, [requests]);

  if (leaveQuery.isLoading && !leaveQuery.data) return <AttendanceSkeleton />;
  if (leaveQuery.isError) {
    return (
      <ErrorState
        message={
          leaveQuery.error instanceof Error
            ? leaveQuery.error.message
            : "Could not load leave requests."
        }
      />
    );
  }

  return (
    <LeavePanelCard
      title="My Leave"
      subtitle="Apply for leave and track request status."
      busy={leaveQuery.isFetching && Boolean(leaveQuery.data)}
      busyLabel="Updating leave…"
      action={
        <button
          type="button"
          onClick={() => setShowApply(true)}
          className="rounded-xl bg-[#0E9384] px-3.5 py-2 text-xs font-extrabold text-white hover:bg-[#0a7d71]"
        >
          Apply Leave
        </button>
      }
    >
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl border border-[#F3E6D4] bg-[#FFF9F1] px-3 py-3">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#B8894A]">
            Pending
          </p>
          <p className="mt-1 text-lg font-extrabold text-[#A87532]">
            {summary.pending}
          </p>
        </div>
        <div className="rounded-xl border border-[#D7EEE9] bg-[#F3FBFA] px-3 py-3">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#5FA89E]">
            Approved
          </p>
          <p className="mt-1 text-lg font-extrabold text-[#0E9384]">
            {summary.approved}
          </p>
        </div>
        <div className="rounded-xl border border-[#E5EDF0] bg-[#F7FAFB] px-3 py-3">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#8B9BA6]">
            Rejected
          </p>
          <p className="mt-1 text-lg font-extrabold text-[#486170]">
            {summary.rejected}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#8B9BA6]">
          Leave History
        </h3>
        {requests.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={CalendarDays}
              title="No leave requests yet."
              detail="Apply for leave when you need time away from work."
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-[#EEF3F5] overflow-hidden rounded-xl border border-[#EEF3F5]">
            {requests.map((request) => (
              <li key={request.id}>
                <button
                  type="button"
                  onClick={() => setSelected(request)}
                  className="flex w-full flex-col gap-2 px-3.5 py-3 text-left transition hover:bg-[#F7FAFB] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#294354]">
                      {dateRangeLabel(request.startDate, request.endDate)}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-[#8294A0]">
                      {leaveTypeLabel(request.leaveType)} ·{" "}
                      {leaveDayPortionLabel(request.dayPortion ?? "full")} ·{" "}
                      {daysLabel(request.totalDays, request.dayPortion ?? "full")}
                    </p>
                    {request.status === "rejected" && request.rejectionReason ? (
                      <p className="mt-1 text-[11px] font-medium text-[#A64D43]">
                        Reason: {request.rejectionReason}
                      </p>
                    ) : null}
                    {request.status === "approved" && request.reviewedByName ? (
                      <p className="mt-1 text-[11px] font-medium text-[#087A6D]">
                        Approved by {request.reviewedByName}
                        {request.reviewedByRole
                          ? ` · ${roleLabel(request.reviewedByRole)}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <LeaveStatusBadge status={request.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showApply ? (
        <ApplyLeaveDialog
          mode="self"
          businessDate={businessDate}
          allowPastDates={canReview}
          onClose={() => setShowApply(false)}
        />
      ) : null}
      {selected ? (
        <ReviewLeaveDialog
          request={selected}
          canManage={canReview}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </LeavePanelCard>
  );
}

function ReviewerLeavePanel({ businessDate }: { businessDate: string }) {
  const [filter, setFilter] = useState<LeaveStatus | "all">("pending");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const leaveQuery = useLeaveRequestsForReview(filter);
  const summaryQuery = useLeaveStatusSummary(true);
  const teamAttendance = useTeamAttendance(businessDate, true);
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [showApply, setShowApply] = useState(false);
  const requests = leaveQuery.data ?? [];
  const summary = summaryQuery.data ?? {
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  };

  const employeeOptions = useMemo(() => {
    const fromTeam = (teamAttendance.data ?? []).map((row) => ({
      value: row.user.id,
      label: row.user.displayName || row.user.email,
    }));
    const fromRequests = requests.map((request) => ({
      value: request.userId,
      label: request.employeeName || request.employeeEmail || request.userId,
    }));
    const byId = new Map<string, { value: string; label: string }>();
    for (const option of [...fromTeam, ...fromRequests]) {
      if (!byId.has(option.value)) byId.set(option.value, option);
    }
    return [
      { value: "all", label: "All employees" },
      ...[...byId.values()].sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [teamAttendance.data, requests]);

  const filteredRequests = useMemo(() => {
    if (employeeFilter === "all") return requests;
    return requests.filter((request) => request.userId === employeeFilter);
  }, [requests, employeeFilter]);

  if (leaveQuery.isLoading && !leaveQuery.data) return <AttendanceSkeleton />;
  if (leaveQuery.isError) {
    return (
      <ErrorState
        message={
          leaveQuery.error instanceof Error
            ? leaveQuery.error.message
            : "Could not load leave requests."
        }
      />
    );
  }

  const softBusy =
    (leaveQuery.isFetching && Boolean(leaveQuery.data)) ||
    (summaryQuery.isFetching && Boolean(summaryQuery.data));

  return (
    <LeavePanelCard
      title="Leave Management"
      subtitle="Review employee leave requests or apply leave directly."
      busy={softBusy}
      busyLabel="Updating leave…"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <ThemedSelect
            aria-label="Filter by employee"
            value={employeeFilter}
            onChange={setEmployeeFilter}
            options={employeeOptions}
          />
          <ThemedSelect
            aria-label="Filter leave status"
            value={filter}
            onChange={(value) => setFilter(value as LeaveStatus | "all")}
            options={[
              { value: "pending", label: "Pending" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
              { value: "all", label: "All" },
            ]}
          />
          <button
            type="button"
            onClick={() => setShowApply(true)}
            className="rounded-xl bg-[#102a3a] px-3.5 py-2 text-xs font-extrabold text-white hover:bg-[#1a3a4d]"
          >
            Apply for Employee
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {(
          [
            {
              status: "pending" as const,
              label: "Pending",
              value: summary.pending,
              card: "border-[#F3E6D4] bg-[#FFF9F1]",
              labelClass: "text-[#B8894A]",
              valueClass: "text-[#A87532]",
            },
            {
              status: "approved" as const,
              label: "Approved",
              value: summary.approved,
              card: "border-[#D7EEE9] bg-[#F3FBFA]",
              labelClass: "text-[#5FA89E]",
              valueClass: "text-[#0E9384]",
            },
            {
              status: "rejected" as const,
              label: "Rejected",
              value: summary.rejected,
              card: "border-[#E5EDF0] bg-[#F7FAFB]",
              labelClass: "text-[#8B9BA6]",
              valueClass: "text-[#486170]",
            },
          ] as const
        ).map((card) => {
          const selected = filter === card.status;
          return (
            <button
              key={card.status}
              type="button"
              onClick={() => setFilter(card.status)}
              className={`rounded-xl border px-3 py-3 text-left transition ${card.card} ${
                selected
                  ? "ring-2 ring-[#0E9384]/35 ring-offset-1"
                  : "hover:brightness-[0.99]"
              }`}
            >
              <p
                className={`text-[9px] font-extrabold uppercase tracking-[0.12em] ${card.labelClass}`}
              >
                {card.label}
              </p>
              <p className={`mt-1 text-lg font-extrabold ${card.valueClass}`}>
                {card.value}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {filteredRequests.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={
              employeeFilter !== "all"
                ? "No leave requests for this employee."
                : filter === "pending"
                  ? "No pending leave requests."
                  : "No leave requests found."
            }
            detail="New requests from employees will appear here."
          />
        ) : (
          <div className="ds-data-table-wrap">
            <table className="ds-data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Dates</th>
                  <th>Type</th>
                  <th>Days</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr
                    key={request.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(request)}
                  >
                    <td className="font-semibold text-[#173247]">
                      {request.employeeName || request.employeeEmail || "—"}
                    </td>
                    <td>
                      {dateRangeLabel(request.startDate, request.endDate)}
                      <span className="mt-0.5 block text-[10px] font-medium text-[#8294A0]">
                        {leaveDayPortionLabel(request.dayPortion ?? "full")}
                      </span>
                    </td>
                    <td>{leaveTypeLabel(request.leaveType)}</td>
                    <td className="font-semibold text-[#173247]">
                      {daysLabel(
                        request.totalDays,
                        request.dayPortion ?? "full",
                      )}
                    </td>
                    <td>
                      <LeaveStatusBadge status={request.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showApply ? (
        <ApplyLeaveDialog
          mode="manager"
          businessDate={businessDate}
          allowPastDates
          onClose={() => setShowApply(false)}
        />
      ) : null}
      {selected ? (
        <ReviewLeaveDialog
          request={selected}
          canManage
          onClose={() => setSelected(null)}
        />
      ) : null}
    </LeavePanelCard>
  );
}

export function LeaveModule({
  canReview,
  showMyLeave = true,
  businessDate,
}: {
  canReview: boolean;
  showMyLeave?: boolean;
  businessDate: string;
}) {
  return (
    <div className="space-y-5">
      {showMyLeave ? (
        <MyLeavePanel canReview={canReview} businessDate={businessDate} />
      ) : null}
      {canReview ? <ReviewerLeavePanel businessDate={businessDate} /> : null}
    </div>
  );
}
