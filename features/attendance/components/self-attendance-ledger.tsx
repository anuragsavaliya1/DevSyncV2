"use client";

import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  LogOut,
  LoaderCircle,
  X,
} from "lucide-react";
import { BusyOverlay } from "@/components/shared/action-loader";
import { TablePagination } from "@/components/shared/table-pagination";
import { QUERY_CONFIG } from "@/constants/query-config";
import { useAttendanceMonth } from "@/features/attendance/hooks/use-attendance";
import { useCreatePunchOutCorrectionRequest } from "@/features/attendance/hooks/use-punch-out-corrections";
import { MetricCard } from "@/features/workspace/components/metric-card";
import { AttendanceSkeleton } from "@/features/workspace/components/loading-skeletons";
import {
  formatDate,
  formatDateTime,
  formatTime,
} from "@/features/workspace/utils/format";
import { useClientPagination } from "@/hooks/use-client-pagination";
import {
  buildCalendarGrid,
  formatHoursShort,
  formatMonthTitle,
  isIndiaWeekend,
  LUNCH_AND_TEA_BREAK_HOURS,
  shiftMonthKey,
  toIndiaDateKey,
  toIndiaMonthKey,
} from "@/lib/attendance-month";
import {
  leaveCoverageSummary,
} from "@/lib/leave-rules";
import type {
  AttendanceCorrectionType,
  AttendanceDay,
  AttendanceDayStatus,
  AttendanceMonthLedger,
} from "@/types/api.types";

function currentIndiaTimeValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "18";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "30";
  return `${hour}:${minute}`;
}

function isoFromWorkDateAndTime(workDate: string, timeHHMM: string) {
  return new Date(`${workDate}T${timeHHMM}:00+05:30`).toISOString();
}

function weekdayLabel(dateKey: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: "Asia/Kolkata",
  }).format(new Date(`${dateKey}T12:00:00+05:30`));
}

function statusLabel(status: AttendanceDayStatus) {
  switch (status) {
    case "present":
      return "On time";
    case "late":
      return "Late";
    case "working":
      return "Working";
    case "missing_punch_out":
      return "Missing out";
    case "missing_punch_in":
      return "Missing in";
    case "absent":
      return "Absent";
    case "weekend":
      return "Week off";
    case "holiday":
      return "Holiday";
    case "leave":
      return "Leave";
    case "future":
      return "Future";
    case "regularized":
      return "Regularized";
    case "manual":
      return "Manual";
    default:
      return status;
  }
}

function statusTone(status: AttendanceDayStatus) {
  switch (status) {
    case "present":
    case "working":
      return "text-[#087A6D] bg-[#EAF7F4]";
    case "late":
    case "missing_punch_out":
    case "missing_punch_in":
      return "text-[#A87532] bg-[#FFF5E7]";
    case "regularized":
      return "text-[#8A6A3A] bg-[#F3EEE4]";
    case "manual":
      return "text-[#4A6070] bg-[#EEF2F6]";
    case "absent":
      return "text-[#A64D43] bg-[#FFF5F4]";
    case "leave":
      return "text-[#2F6B9A] bg-[#E3F0FA]";
    case "holiday":
      return "text-[#9A5B1F] bg-[#FFE9C9]";
    case "weekend":
      return "text-[#7E909C] bg-[#F2F5F6]";
    default:
      return "text-[#7E909C] bg-[#F2F5F6]";
  }
}

function statusDotClass(status: AttendanceDayStatus) {
  switch (status) {
    case "present":
    case "working":
      return "bg-[#0E9384]";
    case "late":
    case "missing_punch_out":
    case "missing_punch_in":
      return "bg-[#D4923A]";
    case "regularized":
      return "bg-[#C9A66B]";
    case "manual":
      return "bg-[#6B7F8C]";
    case "absent":
      return "bg-[#C96B63]";
    case "leave":
      return "bg-[#3D7EB0]";
    case "holiday":
      return "bg-[#D4923A]";
    case "weekend":
    case "future":
    default:
      return "bg-[#9AA8B2]";
  }
}

function listDateSubtext(dateKey: string, today: string, monthKey: string) {
  if (dateKey === today) {
    return formatMonthTitle(monthKey).replace(/\s+\d{4}$/, "");
  }
  return weekdayLabel(dateKey);
}

/** Caption for approved leave on calendar/list (full, half, or hourly). */
function approvedLeaveCaption(day: AttendanceDay) {
  if (day.leaveInfo?.status !== "approved") return null;
  return leaveCoverageSummary({
    dayPortion: day.leaveInfo.dayPortion,
    leaveType: day.leaveInfo.leaveType,
  });
}

function approvedLeaveDetail(day: AttendanceDay) {
  if (day.leaveInfo?.status !== "approved") return null;
  const statusLine = leaveCoverageSummary({
    dayPortion: day.leaveInfo.dayPortion,
    leaveType: day.leaveInfo.leaveType,
  });
  const reason = day.leaveInfo.reason?.trim() || null;
  const attendanceNote =
    day.status !== "leave" && day.punchInAt
      ? "Attendance also recorded for this day."
      : null;
  return { statusLine, reason, attendanceNote };
}

function ListStatusPill({ status }: { status: AttendanceDayStatus }) {
  if (status === "future") {
    return <span className="text-xs font-semibold text-[#9AA8B2]">—</span>;
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.06em] ${statusTone(status)}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass(status)}`}
        aria-hidden
      />
      {statusLabel(status)}
    </span>
  );
}

function ListPunchTime({
  value,
  tone,
}: {
  value: string | null;
  tone: "in" | "out";
}) {
  if (!value) {
    return <span className="text-xs font-semibold text-[#9AA8B2]">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#294354]">
      <Clock
        className={`h-3.5 w-3.5 shrink-0 ${
          tone === "in" ? "text-[#0E9384]" : "text-[#C96B63]"
        }`}
        aria-hidden
      />
      {formatTime(value)}
    </span>
  );
}


function sourceTag(source: string | null | undefined) {
  // Only show managed sources — hide normal employee self-punches.
  if (source === "regularization") return "REGULARIZED";
  if (source === "manual") return "MANUAL";
  return null;
}

function ModalShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-[#173247]/40"
      role="presentation"
      onMouseDown={onClose}
    >
      <div className="flex min-h-dvh w-full items-center justify-center p-3 sm:p-4">
        {children}
      </div>
    </div>,
    document.body,
  );
}

function actorFromDay(day: AttendanceDay) {
  const actor =
    day.attendance?.punchInAudit?.recordedBy ||
    day.attendance?.punchOutAudit?.recordedBy;
  if (!actor) return null;
  const role =
    actor.role === "admin"
      ? "Admin"
      : actor.role === "manager"
        ? "Manager"
        : "Developer";
  return `${actor.displayName || actor.email} · ${role}`;
}

function reviewerRoleLabel(role?: string | null) {
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  return "Manager/Admin";
}

function reviewCommentLabel(day: AttendanceDay) {
  return `${reviewerRoleLabel(day.correctionRequest?.reviewedByRole)} comment`;
}

function regularizationReason(day: AttendanceDay) {
  return (
    day.attendance?.punchInAudit?.reason ||
    day.attendance?.punchOutAudit?.reason ||
    day.correctionRequest?.reason ||
    null
  );
}

function regularizationAt(day: AttendanceDay) {
  return (
    day.attendance?.punchInAudit?.recordedAt ||
    day.attendance?.punchOutAudit?.recordedAt ||
    day.correctionRequest?.reviewedAt ||
    null
  );
}

type CorrectionMode = "punch_out" | "punch_in" | "report_attendance";

function timeValueFromIso(value?: string | null) {
  if (!value) return currentIndiaTimeValue();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "09";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

function CorrectionRequestDialog({
  workDate,
  mode,
  day,
  onClose,
  onSubmitted,
}: {
  workDate: string;
  mode: CorrectionMode;
  day: AttendanceDay | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const createMutation = useCreatePunchOutCorrectionRequest();
  const isEditBoth = Boolean(day?.punchInAt && day?.punchOutAt);
  const hasPunchInOnly = Boolean(day?.punchInAt && !day?.punchOutAt);
  const [punchInTime, setPunchInTime] = useState(() =>
    timeValueFromIso(day?.punchInAt) || "09:05",
  );
  const [punchOutTime, setPunchOutTime] = useState(() =>
    timeValueFromIso(day?.punchOutAt),
  );
  const [includePunchOut, setIncludePunchOut] = useState(
    mode === "report_attendance" || isEditBoth || hasPunchInOnly,
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const title =
    mode === "punch_out"
      ? "Punch-out correction"
      : mode === "punch_in"
        ? "Punch-in correction"
        : isEditBoth
          ? "Edit attendance"
          : hasPunchInOnly
            ? "Correct punch-in"
            : "Report attendance";

  async function submit() {
    setError(null);
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    if (
      mode === "report_attendance" &&
      (isEditBoth || includePunchOut) &&
      !punchOutTime
    ) {
      setError("Requested punch-out time is required.");
      return;
    }
    try {
      let correctionType: AttendanceCorrectionType;
      let requestedPunchInAt: string | null = null;
      let requestedPunchOutAt: string | null = null;

      if (mode === "punch_out") {
        correctionType = "punch_out";
        requestedPunchOutAt = isoFromWorkDateAndTime(workDate, punchOutTime);
      } else if (mode === "punch_in") {
        correctionType = "punch_in";
        requestedPunchInAt = isoFromWorkDateAndTime(workDate, punchInTime);
      } else if (isEditBoth || (includePunchOut && punchOutTime)) {
        correctionType = "punch_in_and_out";
        requestedPunchInAt = isoFromWorkDateAndTime(workDate, punchInTime);
        requestedPunchOutAt = isoFromWorkDateAndTime(workDate, punchOutTime);
      } else {
        correctionType = "punch_in";
        requestedPunchInAt = isoFromWorkDateAndTime(workDate, punchInTime);
      }

      await createMutation.mutateAsync({
        workDate,
        correctionType,
        requestedPunchInAt,
        requestedPunchOutAt,
        reason,
      });
      onSubmitted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit request.");
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[min(92dvh,40rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[#E4ECEF] bg-white p-5 shadow-sm sm:p-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <BusyOverlay active={createMutation.isPending} label="Submitting…" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
              {title}
            </p>
            <h3 className="mt-1 text-lg font-extrabold text-[#102A3A]">
              {formatDate(workDate)} · {weekdayLabel(workDate)}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-2 text-[#6C8291] hover:bg-[#F3F7F8]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {(mode === "punch_in" || mode === "report_attendance") && (
          <div className="mt-4 rounded-xl border border-[#E8F0F2] bg-[#F3FBF9] p-3 text-xs">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#0E9384]">
              Current attendance
            </p>
            {day?.attendance || day?.punchOutAt || day?.punchInAt ? (
              <dl className="mt-2 space-y-1.5">
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-[#7890A0]">Punch in</dt>
                  <dd className="font-semibold text-[#536D7E]">
                    {day.punchInAt ? formatTime(day.punchInAt) : "Not recorded"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-[#7890A0]">Punch out</dt>
                  <dd className="font-semibold text-[#536D7E]">
                    {day.punchOutAt ? formatTime(day.punchOutAt) : "Not recorded"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 font-medium text-[#536D7E]">No attendance recorded</p>
            )}
          </div>
        )}

        <div className="mt-4 space-y-3">
          {mode === "punch_out" ? (
            <label className="block">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#7890A0]">
                Requested punch-out
              </span>
              <input
                type="time"
                value={punchOutTime}
                onChange={(event) => setPunchOutTime(event.target.value)}
                className="ds-control mt-1 w-full"
              />
            </label>
          ) : (
            <>
              <label className="block">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#7890A0]">
                  Requested punch-in
                </span>
                <input
                  type="time"
                  value={punchInTime}
                  onChange={(event) => setPunchInTime(event.target.value)}
                  className="ds-control mt-1 w-full"
                />
              </label>
              {mode === "report_attendance" ? (
                <>
                  {isEditBoth ? null : (
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#DDE7EB] bg-[#F7F9FA] px-3 py-2 text-xs font-semibold text-[#536D7E]">
                      <input
                        type="checkbox"
                        checked={includePunchOut}
                        onChange={(event) =>
                          setIncludePunchOut(event.target.checked)
                        }
                        className="h-3.5 w-3.5 accent-[#0E9384]"
                      />
                      Also add punch-out
                    </label>
                  )}
                  {isEditBoth || includePunchOut ? (
                    <label className="block">
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#7890A0]">
                        Requested punch-out
                      </span>
                      <input
                        type="time"
                        value={punchOutTime}
                        onChange={(event) => setPunchOutTime(event.target.value)}
                        className="ds-control mt-1 w-full"
                      />
                    </label>
                  ) : null}
                </>
              ) : null}
            </>
          )}
          <label className="block">
            <span className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#7890A0]">
                Reason
              </span>
              <span className="text-[9px] font-semibold text-[#9AADB8]">
                {reason.trim().length}/2000
              </span>
            </span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              maxLength={2000}
              className="ds-control mt-0 w-full"
              placeholder="Provide a clear reason for your Manager/Admin…"
            />
          </label>
        </div>
        <p className="mt-3 text-[11px] font-medium text-[#7A654F]">
          Your request will be reviewed by your Manager/Admin.
        </p>
        {error ? (
          <p className="mt-3 rounded-xl bg-[#FFF5F4] p-3 text-xs font-semibold text-[#A64D43]">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#DDE7EB] px-4 py-2.5 text-xs font-semibold text-[#5F7482] transition hover:bg-[#F7FAFB]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => void submit()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0E9384] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {createMutation.isPending ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Submit request
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function DayDetailDialog({
  day,
  onClose,
  onRequestCorrection,
}: {
  day: AttendanceDay;
  onClose: () => void;
  onRequestCorrection: (mode: CorrectionMode) => void;
}) {
  const actor = actorFromDay(day);
  const pending = day.correctionRequest?.status === "pending";
  const rejected = day.correctionRequest?.status === "rejected";
  const canRequestOut =
    day.status === "missing_punch_out" &&
    day.correctionRequest?.status !== "pending";
  const canRequestIn =
    day.status === "missing_punch_in" &&
    day.correctionRequest?.status !== "pending";
  const canReport =
    (day.status === "absent" || day.status === "working") &&
    day.correctionRequest?.status !== "pending" &&
    day.date <= toIndiaDateKey();
  const canEditBoth =
    Boolean(day.punchInAt && day.punchOutAt) &&
    day.status !== "weekend" &&
    day.status !== "future" &&
    day.status !== "holiday" &&
    day.status !== "leave" &&
    day.correctionRequest?.status !== "pending";
  const leaveDetail = approvedLeaveDetail(day);

  const inTag = sourceTag(day.attendance?.punchInSource ?? day.attendance?.punchInAudit?.source);
  const outTag = sourceTag(
    day.attendance?.punchOutSource ?? day.attendance?.punchOutAudit?.source,
  );

  return (
    <ModalShell onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[min(92dvh,40rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[#E4ECEF] bg-white p-5 shadow-sm sm:p-6"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
              Attendance
            </p>
            <h3 className="mt-1 text-lg font-extrabold text-[#102A3A]">
              {formatDate(day.date)}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-2 text-[#6C8291] hover:bg-[#F3F7F8]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <dl className="mt-4 space-y-2.5 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-[#7890A0]">Status</dt>
            <dd className="font-extrabold text-[#102A3A]">
              {statusLabel(day.status)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="inline-flex items-center gap-1.5 font-semibold text-[#7890A0]">
              <LogIn className="h-3.5 w-3.5 text-[#0E9384]" aria-hidden />
              Punch in
              {inTag ? (
                <span className="rounded-full bg-[#F3EEE4] px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.06em] text-[#8A6A3A]">
                  {inTag}
                </span>
              ) : null}
            </dt>
            <dd className="text-right font-semibold text-[#536D7E]">
              {day.punchInAt ? formatTime(day.punchInAt) : "Not recorded"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="inline-flex items-center gap-1.5 font-semibold text-[#7890A0]">
              <LogOut className="h-3.5 w-3.5 text-[#A87532]" aria-hidden />
              Punch out
              {outTag ? (
                <span className="rounded-full bg-[#F3EEE4] px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.06em] text-[#8A6A3A]">
                  {outTag}
                </span>
              ) : null}
            </dt>
            <dd className="text-right font-semibold text-[#536D7E]">
              {day.punchOutAt ? formatTime(day.punchOutAt) : "Not recorded"}
            </dd>
          </div>
          {day.totalHours != null ? (
            <div className="flex justify-between gap-3">
              <dt className="font-semibold text-[#7890A0]">
                Hours
                <span className="ml-1 font-medium normal-case tracking-normal text-[#9AA8B2]">
                  (−{LUNCH_AND_TEA_BREAK_HOURS}h break)
                </span>
              </dt>
              <dd className="font-semibold text-[#536D7E]">
                {formatHoursShort(day.totalHours)}
              </dd>
            </div>
          ) : null}
          {leaveDetail ? (
            <div className="rounded-xl bg-[#EAF1F7] p-3 text-[11px] leading-5 text-[#3D6B8E]">
              <p className="font-extrabold">{leaveDetail.statusLine}</p>
              {leaveDetail.reason ? (
                <p className="mt-1 whitespace-pre-wrap font-medium">
                  <span className="font-extrabold text-[#2F6B9A]">Reason: </span>
                  {leaveDetail.reason}
                </p>
              ) : null}
              {leaveDetail.attendanceNote ? (
                <p className="mt-1 font-medium text-[#536D7E]">
                  {leaveDetail.attendanceNote}
                </p>
              ) : null}
            </div>
          ) : null}
          {day.leaveInfo?.status === "rejected" &&
          day.leaveInfo.rejectionReason ? (
            <p className="rounded-xl bg-[#FFF5F4] p-3 text-[11px] font-medium leading-5 text-[#A64D43]">
              Leave rejected: {day.leaveInfo.rejectionReason}
            </p>
          ) : null}
          {day.status === "missing_punch_out" ? (
            <p className="rounded-xl bg-[#FFF8F0] p-3 text-[11px] font-medium leading-5 text-[#7A654F]">
              You punched in but no punch-out was recorded.
            </p>
          ) : null}
          {day.status === "missing_punch_in" ? (
            <p className="rounded-xl bg-[#FFF8F0] p-3 text-[11px] font-medium leading-5 text-[#7A654F]">
              Punch-out exists but punch-in was not recorded.
            </p>
          ) : null}
          {day.status === "absent" ? (
            <p className="rounded-xl bg-[#FFF5F4] p-3 text-[11px] font-medium leading-5 text-[#7A654F]">
              No attendance recorded. Did you work this day?
            </p>
          ) : null}
          {pending ? (
            <>
              {day.correctionRequest?.requestedPunchInAt ? (
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-[#7890A0]">Requested punch in</dt>
                  <dd className="font-semibold text-[#536D7E]">
                    {formatTime(day.correctionRequest.requestedPunchInAt)}
                  </dd>
                </div>
              ) : null}
              {day.correctionRequest?.requestedPunchOutAt ? (
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-[#7890A0]">Requested punch out</dt>
                  <dd className="font-semibold text-[#536D7E]">
                    {formatTime(day.correctionRequest.requestedPunchOutAt)}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="font-semibold text-[#7890A0]">Reason</dt>
                <dd className="mt-1 font-medium text-[#536D7E]">
                  {day.correctionRequest?.reason || "—"}
                </dd>
              </div>
              <p className="text-[11px] font-medium text-[#7A654F]">
                Waiting for Manager/Admin review.
              </p>
            </>
          ) : null}
          {rejected ? (
            <>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#A64D43]">
                Correction rejected
              </p>
              <div>
                <dt className="font-semibold text-[#7890A0]">
                  {reviewCommentLabel(day)}
                </dt>
                <dd className="mt-1 font-medium text-[#536D7E]">
                  {day.correctionRequest?.reviewNote || "—"}
                </dd>
              </div>
            </>
          ) : null}
          {day.status === "regularized" || day.status === "manual" ? (
            <>
              <div className="flex justify-between gap-3">
                <dt className="font-semibold text-[#7890A0]">
                  {day.status === "manual" ? "Added by" : "Regularized by"}
                </dt>
                <dd className="truncate text-right font-extrabold text-[#102A3A]">
                  {actor || "—"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[#7890A0]">Reason</dt>
                <dd className="mt-1 font-medium text-[#536D7E]">
                  {regularizationReason(day) || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-semibold text-[#7890A0]">
                  {day.status === "manual" ? "Added at" : "Approved at"}
                </dt>
                <dd className="font-semibold text-[#536D7E]">
                  {formatDateTime(regularizationAt(day))}
                </dd>
              </div>
            </>
          ) : null}
        </dl>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#DDE7EB] px-4 py-2.5 text-xs font-semibold text-[#5F7482]"
          >
            Close
          </button>
          {canRequestOut ? (
            <button
              type="button"
              onClick={() => onRequestCorrection("punch_out")}
              className="rounded-xl bg-[#0E9384] px-4 py-2.5 text-xs font-semibold text-white"
            >
              Request punch-out
            </button>
          ) : null}
          {canRequestIn ? (
            <button
              type="button"
              onClick={() => onRequestCorrection("punch_in")}
              className="rounded-xl bg-[#0E9384] px-4 py-2.5 text-xs font-semibold text-white"
            >
              Request punch-in
            </button>
          ) : null}
          {canReport || canEditBoth ? (
            <button
              type="button"
              onClick={() => onRequestCorrection("report_attendance")}
              className="rounded-xl bg-[#0E9384] px-4 py-2.5 text-xs font-semibold text-white"
            >
              Report attendance
            </button>
          ) : null}
        </div>
      </div>
    </ModalShell>
  );
}

function DayCard({
  day,
  isToday,
  onOpen,
}: {
  day: AttendanceDay;
  isToday: boolean;
  onOpen: () => void;
}) {
  const isSunday = isIndiaWeekend(day.date);
  const isConfiguredWeekOff = day.holidayInfo?.kind === "weekoff";
  const isRedWeekOff = isSunday || isConfiguredWeekOff;
  const interactive =
    day.status !== "weekend" &&
    day.status !== "future" &&
    day.status !== "holiday";
  const leaveCaption = approvedLeaveCaption(day);
  const actor = actorFromDay(day);
  const pending = day.correctionRequest?.status === "pending";
  const rejected = day.correctionRequest?.status === "rejected";
  const badgeOnLeft =
    day.status === "regularized" || day.status === "manual";

  const statusBadge =
    day.status !== "weekend" && day.status !== "future" ? (
      <span
        className={`shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.06em] ${statusTone(day.status)}`}
      >
        {statusLabel(day.status)}
      </span>
    ) : isRedWeekOff ? (
      <span className="shrink-0 whitespace-nowrap rounded-full bg-[#FFF1EF] px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.06em] text-[#A64D43]">
        {statusLabel(day.status)}
      </span>
    ) : (
      <span className="shrink-0 whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.08em] text-[#9AA8B2]">
        {statusLabel(day.status)}
      </span>
    );

  const dayNumber = (
    <span
      className={`shrink-0 text-sm font-extrabold ${
        isToday
          ? "flex h-6 w-6 items-center justify-center rounded-full bg-[#0E9384] text-white"
          : isRedWeekOff
            ? "text-[#A64D43]"
            : day.status === "holiday"
              ? "text-[#9A5B1F]"
              : day.status === "leave"
                ? "text-[#2F6B9A]"
                : "text-[#294354]"
      }`}
    >
      {day.dayOfMonth}
    </span>
  );

  const cardTone = isToday
    ? "border-[#0E9384] bg-[#EAF7F4] ring-2 ring-[#0E9384]/25 hover:border-[#087A6D]"
    : isRedWeekOff
      ? "cursor-default border-[#F0C9C4] bg-[#FFF5F4] shadow-[inset_0_0_0_1px_rgba(166,77,67,0.12)]"
      : day.status === "holiday"
        ? "cursor-default border-[#F0C98A] bg-[#FFF6E8] shadow-[inset_0_0_0_1px_rgba(212,146,58,0.12)]"
        : day.status === "leave"
          ? "border-[#A9CBE6] bg-[#EEF6FC] shadow-[inset_0_0_0_1px_rgba(61,126,176,0.12)] hover:border-[#7EAFD4]"
          : interactive
            ? "border-[#E1EAED] bg-white hover:border-[#C5D7DE] hover:shadow-sm"
            : "cursor-default border-transparent bg-[#F8FAFB] opacity-80";

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onOpen}
      aria-current={isToday ? "date" : undefined}
      className={`flex min-h-[108px] w-full min-w-[118px] flex-col rounded-xl border p-2.5 text-left transition ${cardTone}`}
    >
      <div className="flex items-start justify-between gap-1">
        {badgeOnLeft ? (
          <>
            {statusBadge}
            {dayNumber}
          </>
        ) : (
          <>
            {dayNumber}
            {statusBadge}
          </>
        )}
      </div>

      {day.status === "future" ? (
        <p className="mt-auto pt-3 text-[10px] font-medium text-[#9AA8B2]">
          No attendance yet
        </p>
      ) : day.status === "weekend" ? (
        <p
          className="mt-auto pt-3 text-[10px] font-extrabold leading-4 text-[#A64D43]"
          title={
            isSunday
              ? "Sunday"
              : day.holidayInfo?.name || "Week off"
          }
        >
          {isSunday
            ? "Sunday"
            : day.holidayInfo?.name || "Week off"}
        </p>
      ) : day.status === "holiday" ? (
        <p
          className="mt-auto pt-3 text-[10px] font-extrabold leading-4 text-[#9A5B1F]"
          title={day.holidayInfo?.name || "Holiday"}
        >
          {day.holidayInfo?.name || "Company holiday"}
        </p>
      ) : day.status === "leave" ? (
        <div className="mt-auto flex flex-1 flex-col items-center justify-center gap-0.5 px-0.5 pt-2 text-center">
          <p className="text-[10px] font-extrabold leading-4 text-[#2F6B9A]">
            {leaveCaption ?? "Approved leave"}
          </p>
          {day.leaveInfo?.reason ? (
            <p
              className="line-clamp-2 text-[9px] font-semibold leading-3.5 text-[#3D6B8E]"
              title={day.leaveInfo.reason}
            >
              {day.leaveInfo.reason}
            </p>
          ) : null}
        </div>
      ) : day.status === "absent" ? (
        <div className="mt-auto space-y-1 pt-3">
          <p className="text-[10px] font-medium text-[#9AA8B2]">
            No attendance recorded
          </p>
          {day.leaveInfo?.status === "rejected" &&
          day.leaveInfo.rejectionReason ? (
            <p className="text-[10px] font-medium leading-4 text-[#A64D43]">
              Leave rejected: {day.leaveInfo.rejectionReason}
            </p>
          ) : null}
          {pending ? (
            <p className="font-extrabold uppercase tracking-[0.06em] text-[#A87532]" style={{ fontSize: 9 }}>
              Correction pending
            </p>
          ) : rejected ? (
            <p className="font-extrabold uppercase tracking-[0.06em] text-[#A64D43]" style={{ fontSize: 9 }}>
              Correction rejected
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 space-y-0.5 text-[10px] font-medium text-[#6A7F8C]">
          <p className="flex items-center gap-1">
            <LogIn className="h-3 w-3 shrink-0 text-[#0E9384]" aria-hidden />
            <span className="sr-only">In</span>
            {day.punchInAt ? formatTime(day.punchInAt) : "—"}
          </p>
          <p className="flex items-center gap-1">
            <LogOut className="h-3 w-3 shrink-0 text-[#A87532]" aria-hidden />
            <span className="sr-only">Out</span>
            {day.punchOutAt ? formatTime(day.punchOutAt) : "—"}
          </p>
          {leaveCaption ? (
            <p
              className="pt-0.5 text-[9px] font-extrabold leading-3 text-[#2F6B9A]"
              title={day.leaveInfo?.reason || leaveCaption}
            >
              {leaveCaption}
            </p>
          ) : null}
          {day.leaveInfo?.status === "rejected" &&
          day.leaveInfo.rejectionReason ? (
            <p className="pt-1 text-[10px] font-medium leading-4 text-[#A64D43]">
              Leave rejected: {day.leaveInfo.rejectionReason}
            </p>
          ) : null}
          {day.totalHours != null ? (
            <p
              className="font-semibold text-[#536D7E]"
              title={`Net of ${LUNCH_AND_TEA_BREAK_HOURS}h lunch + tea break`}
            >
              {formatHoursShort(day.totalHours)}
            </p>
          ) : null}
          {(day.status === "missing_punch_out" ||
            day.status === "missing_punch_in") &&
          pending ? (
            <p className="pt-1 font-extrabold uppercase tracking-[0.06em] text-[#A87532]">
              Correction pending
            </p>
          ) : null}
          {(day.status === "missing_punch_out" ||
            day.status === "missing_punch_in") &&
          rejected ? (
            <p className="pt-1 font-extrabold uppercase tracking-[0.06em] text-[#A64D43]">
              Correction rejected
            </p>
          ) : null}
          {day.punchInAt &&
          day.punchOutAt &&
          day.correctionRequest?.status === "pending" ? (
            <p className="pt-1 font-extrabold uppercase tracking-[0.06em] text-[#A87532]">
              Correction pending
            </p>
          ) : null}
          {day.punchInAt &&
          day.punchOutAt &&
          day.correctionRequest?.status === "rejected" ? (
            <p className="pt-1 font-extrabold uppercase tracking-[0.06em] text-[#A64D43]">
              Correction rejected
            </p>
          ) : null}
          {(day.status === "regularized" || day.status === "manual") && actor ? (
            <p className="truncate pt-1 text-[9px] text-[#8A9AAB]" title={actor}>
              by {actor}
            </p>
          ) : null}
        </div>
      )}
    </button>
  );
}

function MonthBody({
  ledger,
  view,
  today,
  onOpenDay,
}: {
  ledger: AttendanceMonthLedger;
  view: "calendar" | "list";
  today: string;
  onOpenDay: (day: AttendanceDay) => void;
}) {
  const byDate = useMemo(() => {
    const map = new Map(ledger.days.map((day) => [day.date, day]));
    return map;
  }, [ledger.days]);

  const listRows = useMemo(
    () =>
      [...ledger.days]
        .filter(
          (day) =>
            day.date <= today ||
            day.status === "holiday" ||
            day.status === "leave" ||
            (day.status === "weekend" && day.holidayInfo?.kind === "weekoff"),
        )
        .reverse(),
    [ledger.days, today],
  );
  const listPage = useClientPagination(
    listRows,
    QUERY_CONFIG.listPageSize,
    `${ledger.month}:list`,
  );

  if (view === "list") {
    return (
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] gap-3 border-b border-[#EAF0F2] px-3 pb-3 text-left text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#7890A0]">
            <span>Date</span>
            <span>Status</span>
            <span>Punch in</span>
            <span>Punch out</span>
          </div>
          <div className="divide-y divide-[#EEF3F5]">
            {listPage.pageItems.map((day) => {
              const isToday = day.date === today;
              const interactive =
                day.status !== "weekend" &&
                day.status !== "future" &&
                day.status !== "holiday";
              const leaveCaption = approvedLeaveCaption(day);
              const rowTone =
                day.status === "holiday"
                  ? "bg-[#FFF8EE]"
                  : day.status === "leave"
                    ? "bg-[#F3F8FC]"
                    : day.status === "weekend" &&
                        (isIndiaWeekend(day.date) ||
                          day.holidayInfo?.kind === "weekoff")
                      ? "bg-[#FFF5F4]"
                      : isToday
                        ? "bg-[#EAF7F4]"
                        : interactive
                          ? "bg-white hover:bg-[#F8FAFB]"
                          : "cursor-default bg-white";
              return (
                <button
                  key={day.date}
                  type="button"
                  disabled={!interactive}
                  onClick={() => onOpenDay(day)}
                  aria-current={isToday ? "date" : undefined}
                  className={`grid w-full grid-cols-[1.3fr_1fr_1fr_1fr] gap-3 px-3 py-3.5 text-left transition ${rowTone}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-[#102A3A]">
                      {formatDate(day.date)}
                    </p>
                    <p
                      className="mt-0.5 truncate text-[11px] font-medium text-[#8494A0]"
                      title={
                        leaveCaption
                          ? [leaveCaption, day.leaveInfo?.reason]
                              .filter(Boolean)
                              .join(" — ")
                          : undefined
                      }
                    >
                      {day.status === "holiday" && day.holidayInfo?.name
                        ? day.holidayInfo.name
                        : day.status === "weekend" &&
                            day.holidayInfo?.kind === "weekoff"
                          ? day.holidayInfo.name || "Week off"
                          : leaveCaption
                            ? day.leaveInfo?.reason
                              ? `${leaveCaption} · ${day.leaveInfo.reason}`
                              : leaveCaption
                            : listDateSubtext(day.date, today, ledger.month)}
                    </p>
                  </div>
                  <div className="flex items-center justify-start">
                    <ListStatusPill status={day.status} />
                  </div>
                  <div className="flex items-center justify-start">
                    <ListPunchTime value={day.punchInAt} tone="in" />
                  </div>
                  <div className="flex items-center justify-start">
                    <ListPunchTime value={day.punchOutAt} tone="out" />
                  </div>
                </button>
              );
            })}
          </div>
          <TablePagination {...listPage.paginationProps} />
        </div>
      </div>
    );
  }

  const cells = buildCalendarGrid(ledger.month);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[880px]">
        <div className="mb-2 grid grid-cols-[repeat(7,minmax(118px,1fr))] gap-2 text-center text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#7890A0]">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
            <span
              key={label}
              className={label === "Sun" ? "text-[#A64D43]" : undefined}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-[repeat(7,minmax(118px,1fr))] gap-2">
          {cells.map((cell) => {
            if (!cell.inMonth) {
              return (
                <div
                  key={`adj-${cell.date}`}
                  className="min-h-[108px] min-w-[118px] rounded-xl bg-[#FBFCFD] p-2.5 text-[11px] font-semibold text-[#C0CAD1]"
                >
                  {Number(cell.date.slice(8, 10))}
                </div>
              );
            }
            const day = byDate.get(cell.date);
            if (!day) return <div key={cell.date} className="min-w-[118px]" />;
            return (
              <DayCard
                key={day.date}
                day={day}
                isToday={day.date === today}
                onOpen={() => onOpenDay(day)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SelfAttendanceLedger() {
  const todayMonth = toIndiaMonthKey();
  const today = toIndiaDateKey();
  const [month, setMonth] = useState(todayMonth);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [selectedDay, setSelectedDay] = useState<AttendanceDay | null>(null);
  const [correction, setCorrection] = useState<{
    date: string;
    mode: CorrectionMode;
    day: AttendanceDay;
  } | null>(null);

  const ledgerQuery = useAttendanceMonth(month, true);
  const ledger = ledgerQuery.data;
  const loading = ledgerQuery.isLoading && !ledger;
  const error =
    ledgerQuery.error instanceof Error ? ledgerQuery.error.message : null;
  const showingStale = Boolean(
    ledger && ledger.month !== month && ledgerQuery.isFetching,
  );

  if (loading) return <AttendanceSkeleton />;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
      <BusyOverlay active={showingStale} label={`Loading ${formatMonthTitle(month)}…`} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAF0F2] p-5">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
            Attendance · Self review
          </p>
          <h2 className="mt-1 text-lg font-extrabold">
            {formatMonthTitle(month)}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-[#E1EAED] bg-[#F8FAFB] p-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth((value) => shiftMonthKey(value, -1))}
              className="rounded-lg p-1.5 text-[#536D7E] hover:bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Go to current month"
              onClick={() => setMonth(todayMonth)}
              className="min-w-[7.5rem] rounded-lg px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#3F5A6A] hover:bg-white"
            >
              {formatMonthTitle(month).replace(/\s+\d{4}$/, "")}
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth((value) => shiftMonthKey(value, 1))}
              className="rounded-lg p-1.5 text-[#536D7E] hover:bg-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex rounded-xl border border-[#E1EAED] p-1">
            {(["calendar", "list"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`rounded-lg px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] ${
                  view === mode
                    ? "bg-[#0E9384] text-white"
                    : "text-[#6A7F8C] hover:bg-[#F8FAFB]"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {ledger ? (
        <div className="grid gap-3 border-b border-[#EAF0F2] p-5 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            label="Present"
            value={`${ledger.summary.present} / ${ledger.summary.workingDays}`}
            tone="teal"
          />
          <MetricCard
            label="Late"
            value={String(ledger.summary.late)}
            tone="amber"
          />
          <MetricCard
            label="Leave"
            value={String(ledger.summary.leave ?? 0)}
            tone="blue"
          />
          <MetricCard
            label="Hours"
            value={formatHoursShort(ledger.summary.hours)}
            tone="slate"
          />
          <MetricCard
            label="Needs action"
            value={`${ledger.summary.needsAction} days`}
            tone={ledger.summary.needsAction ? "rose" : "slate"}
          />
        </div>
      ) : null}

      <div className="p-5">
        {error ? (
          <p className="rounded-xl bg-[#FFF5F4] p-3 text-xs font-semibold text-[#A64D43]">
            {error}
          </p>
        ) : null}
        {ledger ? (
          <MonthBody
            ledger={ledger}
            view={view}
            today={today}
            onOpenDay={(day) => setSelectedDay(day)}
          />
        ) : null}
        <p className="mt-4 text-[11px] font-medium leading-5 text-[#708492]">
          Office hours 9:00 AM–6:30 PM IST. On-time grace ends 9:15 AM. Today is {today}.
        </p>
      </div>

      {selectedDay ? (
        <DayDetailDialog
          day={selectedDay}
          onClose={() => setSelectedDay(null)}
          onRequestCorrection={(mode) => {
            setCorrection({ date: selectedDay.date, mode, day: selectedDay });
            setSelectedDay(null);
          }}
        />
      ) : null}
      {correction ? (
        <CorrectionRequestDialog
          workDate={correction.date}
          mode={correction.mode}
          day={correction.day}
          onClose={() => setCorrection(null)}
          onSubmitted={() => {
            void ledgerQuery.refetch();
          }}
        />
      ) : null}
    </section>
  );
}
