"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import {
  ArrowRightLeft,
  ClipboardCheck,
  Clock3,
  LoaderCircle,
  LogIn,
  LogOut,
  X,
} from "lucide-react";
import { BusyOverlay } from "@/components/shared/action-loader";
import { ThemedSelect } from "@/components/shared/themed-select";
import { useTeamAttendance } from "@/features/attendance/hooks/use-attendance";
import {
  useApprovePunchOutCorrectionRequest,
  useManualPunchOutEmployee,
  usePendingPunchOutCorrectionRequests,
  useRejectPunchOutCorrectionRequest,
} from "@/features/attendance/hooks/use-punch-out-corrections";
import { SelfAttendanceLedger } from "@/features/attendance/components/self-attendance-ledger";
import { AttendanceSkeleton } from "@/features/workspace/components/loading-skeletons";
import {
  formatDate,
  formatDateTime,
  formatTime,
  initials,
} from "@/features/workspace/utils/format";
import {
  isManagedPunchInSource,
  isManagedPunchOutSource,
  resolvePunchInSource,
  resolvePunchOutSource,
  teamAttendanceStatusLabel,
  teamAttendanceStatusLayers,
  teamAttendanceStatusTagClass,
  type TeamAttendanceStatusTag,
} from "@/lib/punch-out-audit";
import type {
  AttendanceCorrectionType,
  AttendanceRecord,
  PunchOutAudit,
  PunchOutCorrectionRequest,
  WorkspaceUser,
} from "@/types/api.types";

function roleLabel(role: string) {
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  return "Developer";
}

function actorLabel(audit: PunchOutAudit | null | undefined) {
  const actor = audit?.recordedBy;
  if (!actor) return null;
  const name = actor.displayName || actor.email;
  return `${name} · ${roleLabel(actor.role)}`;
}

function correctionTypeLabel(type: AttendanceCorrectionType | undefined) {
  if (type === "punch_in") return "Punch In";
  if (type === "punch_in_and_out") return "In + Out";
  return "Punch Out";
}

function correctionTypeMeta(type: AttendanceCorrectionType | undefined) {
  if (type === "punch_in") {
    return {
      label: "Punch In",
      icon: LogIn,
      chip: "bg-[#EAF1F9] text-[#3B6EA5]",
      iconWrap: "bg-[#EAF1F9] text-[#3B6EA5]",
    };
  }
  if (type === "punch_in_and_out") {
    return {
      label: "In + Out",
      icon: ArrowRightLeft,
      chip: "bg-[#EAF7F4] text-[#087A6D]",
      iconWrap: "bg-[#EAF7F4] text-[#087A6D]",
    };
  }
  return {
    label: "Punch Out",
    icon: LogOut,
    chip: "bg-[#FFF3E4] text-[#A87532]",
    iconWrap: "bg-[#FFF3E4] text-[#A87532]",
  };
}

function correctionTimePreview(item: PunchOutCorrectionRequest) {
  const parts: string[] = [];
  if (item.requestedPunchInAt) {
    parts.push(`In ${formatTime(item.requestedPunchInAt)}`);
  }
  if (item.requestedPunchOutAt) {
    parts.push(`Out ${formatTime(item.requestedPunchOutAt)}`);
  }
  return parts.join(" · ");
}

function currentIndiaTimeValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find(part => part.type === "hour")?.value ?? "18";
  const minute = parts.find(part => part.type === "minute")?.value ?? "30";
  return `${hour}:${minute}`;
}

/** Build an ISO timestamp interpreting local civil time as Asia/Kolkata. */
function isoFromWorkDateAndTime(workDate: string, timeHHMM: string) {
  return new Date(`${workDate}T${timeHHMM}:00+05:30`).toISOString();
}

function ReviewCorrectionDialog({
  request,
  onClose,
}: {
  request: PunchOutCorrectionRequest;
  onClose: () => void;
}) {
  const approveMutation = useApprovePunchOutCorrectionRequest();
  const rejectMutation = useRejectPunchOutCorrectionRequest();
  const [mode, setMode] = useState<"review" | "reject">("review");
  const [reviewNote, setReviewNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busy = approveMutation.isPending || rejectMutation.isPending;
  const type = request.correctionType || "punch_out";
  const isPunchIn = type === "punch_in" || type === "punch_in_and_out";

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
    if (!reviewNote.trim()) {
      setError("A review note is required.");
      return;
    }
    try {
      await rejectMutation.mutateAsync({
        requestId: request.id,
        input: { reviewNote },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#173247]/35 p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl border border-[#E4ECEF] bg-white p-6 shadow-sm"
        onMouseDown={event => event.stopPropagation()}
      >
        <BusyOverlay active={busy} label="Updating…" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
              {isPunchIn ? "Punch-in correction" : "Punch-out correction"}
            </p>
            <h3 className="mt-1 text-lg font-extrabold text-[#102A3A]">
              Review request
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-2 text-[#6C8291] transition hover:bg-[#F3F7F8]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <dl className="mt-4 space-y-2 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-[#7890A0]">Employee</dt>
            <dd className="font-extrabold text-[#102A3A]">
              {request.employeeName || request.employeeEmail || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-[#7890A0]">Date</dt>
            <dd className="font-semibold text-[#536D7E]">
              {formatDate(request.workDate)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-[#7890A0]">Type</dt>
            <dd className="font-semibold text-[#536D7E]">
              {correctionTypeLabel(type)}
            </dd>
          </div>
          <div className="rounded-xl bg-[#F8FAFB] p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#7890A0]">
              Current attendance
            </p>
            {request.punchInAt || request.punchOutAt ? (
              <div className="mt-2 space-y-1.5">
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-[#7890A0]">Punch in</dt>
                  <dd className="font-semibold text-[#536D7E]">
                    {request.punchInAt
                      ? formatTime(request.punchInAt)
                      : "Not recorded"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-[#7890A0]">Punch out</dt>
                  <dd className="font-semibold text-[#536D7E]">
                    {request.punchOutAt
                      ? formatTime(request.punchOutAt)
                      : "Not recorded"}
                  </dd>
                </div>
              </div>
            ) : (
              <p className="mt-2 font-medium text-[#536D7E]">
                No attendance recorded
              </p>
            )}
          </div>
          {request.requestedPunchInAt ? (
            <div className="flex justify-between gap-3">
              <dt className="font-semibold text-[#7890A0]">
                Requested punch in
              </dt>
              <dd className="font-semibold text-[#536D7E]">
                {formatTime(request.requestedPunchInAt)}
              </dd>
            </div>
          ) : null}
          {request.requestedPunchOutAt ? (
            <div className="flex justify-between gap-3">
              <dt className="font-semibold text-[#7890A0]">
                Requested punch out
              </dt>
              <dd className="font-semibold text-[#536D7E]">
                {formatTime(request.requestedPunchOutAt)}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="font-semibold text-[#7890A0]">Reason</dt>
            <dd className="mt-1 font-medium leading-5 text-[#536D7E]">
              {request.reason}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-[#7890A0]">Requested at</dt>
            <dd className="font-semibold text-[#536D7E]">
              {formatTime(request.createdAt)}
            </dd>
          </div>
        </dl>
        {mode === "reject" && (
          <label className="mt-4 block">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#7890A0]">
              Review note
            </span>
            <textarea
              value={reviewNote}
              onChange={event => setReviewNote(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Requested time could not be verified."
              className="ds-control mt-1 w-full resize-none"
            />
          </label>
        )}
        {error && (
          <p className="mt-3 rounded-xl bg-[#FFF5F4] p-3 text-xs font-semibold text-[#A64D43]">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {mode === "review" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => setMode("reject")}
                className="rounded-xl border border-[#F0D4D0] px-4 py-2.5 text-xs font-semibold text-[#A64D43] transition hover:bg-[#FFF5F4]"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void approve()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0E9384] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#087A6D] disabled:opacity-60"
              >
                {approveMutation.isPending ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {approveMutation.isPending ? "Approving…" : "Approve"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => setMode("review")}
                className="rounded-xl border border-[#DDE7EB] px-4 py-2.5 text-xs font-semibold text-[#5F7482] transition hover:bg-[#F7FAFB]"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void reject()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#A64D43] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#8F3F36] disabled:opacity-60"
              >
                {rejectMutation.isPending ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Confirm reject
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PunchOutAuditDialog({
  employee,
  attendance,
  onClose,
}: {
  employee: WorkspaceUser;
  attendance: AttendanceRecord;
  onClose: () => void;
}) {
  const outAudit = attendance.punchOutAudit;
  const inAudit = attendance.punchInAudit;
  const outSource = resolvePunchOutSource(attendance);
  const inSource = resolvePunchInSource(attendance);
  const primaryAudit =
    (inSource === "regularization" || inSource === "manual" ? inAudit : null) ||
    outAudit;
  const isManual = outSource === "manual" || inSource === "manual";
  const actor = primaryAudit?.recordedBy;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#173247]/35 p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-[#E4ECEF] bg-white p-6 shadow-sm"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
              Attendance correction
            </p>
            <h3 className="mt-1 text-lg font-extrabold text-[#102A3A]">
              {isManual ? "Manual attendance" : "Regularized attendance"}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-2 text-[#6C8291] transition hover:bg-[#F3F7F8]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <dl className="mt-4 space-y-2.5 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-[#7890A0]">Employee</dt>
            <dd className="text-right font-extrabold text-[#102A3A]">
              {employee.displayName || employee.email}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-[#7890A0]">Work date</dt>
            <dd className="font-semibold text-[#536D7E]">
              {formatDate(attendance.workDate)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="inline-flex items-center gap-1.5 font-semibold text-[#7890A0]">
              Punch in
              {inSource === "manual" || inSource === "regularization" ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.06em] ${
                    inSource === "manual"
                      ? "bg-[#EEF2F6] text-[#4A6070]"
                      : "bg-[#F3EEE4] text-[#8A6A3A]"
                  }`}
                >
                  {inSource === "manual" ? "Manual" : "Regularized"}
                </span>
              ) : null}
            </dt>
            <dd className="text-right font-semibold text-[#536D7E]">
              {attendance.punchInAt ? formatTime(attendance.punchInAt) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="inline-flex items-center gap-1.5 font-semibold text-[#7890A0]">
              Punch out
              {outSource === "manual" || outSource === "regularization" ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.06em] ${
                    outSource === "manual"
                      ? "bg-[#EEF2F6] text-[#4A6070]"
                      : "bg-[#F3EEE4] text-[#8A6A3A]"
                  }`}
                >
                  {outSource === "manual" ? "Manual" : "Regularized"}
                </span>
              ) : null}
            </dt>
            <dd className="text-right font-semibold text-[#536D7E]">
              {attendance.punchOutAt ? formatTime(attendance.punchOutAt) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-[#7890A0]">
              {isManual ? "Added by" : "Approved by"}
            </dt>
            <dd className="truncate text-right font-extrabold text-[#102A3A]">
              {actor?.displayName || actor?.email || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-[#7890A0]">Role</dt>
            <dd className="font-semibold text-[#536D7E]">
              {actor ? roleLabel(actor.role) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-semibold text-[#7890A0]">
              {isManual ? "Added at" : "Approved at"}
            </dt>
            <dd className="font-semibold text-[#536D7E]">
              {formatDateTime(primaryAudit?.recordedAt)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[#7890A0]">Reason</dt>
            <dd className="mt-1 font-medium leading-5 text-[#536D7E]">
              {primaryAudit?.reason || "—"}
            </dd>
          </div>
        </dl>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#DDE7EB] px-4 py-2.5 text-xs font-semibold text-[#5F7482] transition hover:bg-[#F7FAFB]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function SourcePill({
  side,
  source,
}: {
  side: "IN" | "OUT";
  source: "employee" | "regularization" | "manual" | null;
}) {
  if (!source || source === "employee") return null;
  const isManual = source === "manual";
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 font-extrabold tracking-[0.06em] ${
        isManual ? "bg-[#EEF2F6] text-[#4A6070]" : "bg-[#F3EEE4] text-[#8A6A3A]"
      }`}
      style={{ fontSize: "10px" }}
    >
      {side} · {isManual ? "MANUAL" : "REGULARIZED"}
    </span>
  );
}

function TeamActionCell({
  record,
  pending,
  onReview,
  onManual,
  onOpenAudit,
}: {
  record: AttendanceRecord | null;
  pending: PunchOutCorrectionRequest | null;
  onReview: () => void;
  onManual: () => void;
  onOpenAudit: () => void;
}) {
  if (pending?.status === "pending") {
    return (
      <button
        type="button"
        onClick={onReview}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#F2D4B8] bg-[#FFF8F0] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#A65D1C] shadow-[0_1px_2px_rgba(166,93,28,0.08)] transition hover:border-[#E8B98A] hover:bg-[#FFF1E4]"
      >
        Review
      </button>
    );
  }

  if (record?.state === "working" && !record.punchOutAt && record.punchInAt) {
    return (
      <button
        type="button"
        onClick={onManual}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#B9DCD5] bg-[#F3FBFA] px-3 py-1.5 text-[10px] font-extrabold tracking-[0.08em] text-[#087A6D] shadow-[0_1px_2px_rgba(14,147,132,0.12)] transition hover:border-[#0E9384] hover:bg-[#EAF7F4] hover:shadow-[0_4px_10px_rgba(14,147,132,0.16)] active:scale-[0.98]"
      >
        <LogOut className="h-3 w-3 shrink-0" />
        punch out
      </button>
    );
  }

  const outSource = resolvePunchOutSource(record ?? {});
  const inSource = resolvePunchInSource(record ?? {});
  const managedOut = isManagedPunchOutSource(outSource);
  const managedIn = isManagedPunchInSource(inSource);
  if (managedOut || managedIn) {
    const by =
      actorLabel(record?.punchInAudit) || actorLabel(record?.punchOutAudit);
    return (
      <button
        type="button"
        onClick={onOpenAudit}
        title={by ? `by ${by}` : undefined}
        className="flex flex-wrap items-center gap-1"
      >
        <SourcePill side="IN" source={managedIn ? inSource : null} />
        <SourcePill side="OUT" source={managedOut ? outSource : null} />
      </button>
    );
  }

  return <span className="text-[10px] font-semibold text-[#7D909D]">—</span>;
}

function ManualPunchOutDialog({
  employee,
  workDate,
  onClose,
}: {
  employee: WorkspaceUser;
  workDate: string;
  onClose: () => void;
}) {
  const manualMutation = useManualPunchOutEmployee();
  const [time, setTime] = useState(currentIndiaTimeValue);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    try {
      await manualMutation.mutateAsync({
        userId: employee.id,
        workDate,
        punchOutAt: isoFromWorkDateAndTime(workDate, time),
        reason,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save punch-out."
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#173247]/35 p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl border border-[#E4ECEF] bg-white p-6 shadow-sm"
        onMouseDown={event => event.stopPropagation()}
      >
        <BusyOverlay active={manualMutation.isPending} label="Saving…" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
              Manual punch-out
            </p>
            <h3 className="mt-1 text-lg font-extrabold text-[#102A3A]">
              Add punch out
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-2 text-[#6C8291] transition hover:bg-[#F3F7F8]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs font-medium text-[#536D7E]">
          {employee.displayName || employee.email} · {formatDate(workDate)}
        </p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#7890A0]">
              Punch-out time
            </span>
            <input
              type="time"
              value={time}
              onChange={event => setTime(event.target.value)}
              className="ds-control mt-1 w-full"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#7890A0]">
              Reason
            </span>
            <textarea
              value={reason}
              onChange={event => setReason(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Employee forgot to punch out."
              className="ds-control mt-1 w-full resize-none"
            />
          </label>
        </div>
        {error ? (
          <p className="mt-3 rounded-xl bg-[#FFF5F4] p-3 text-xs font-semibold text-[#A64D43]">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#DDE7EB] px-4 py-2.5 text-xs font-semibold text-[#5F7482]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={manualMutation.isPending}
            onClick={() => void submit()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0E9384] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {manualMutation.isPending ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Save punch-out
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamStatusPills({
  record,
  pending,
  onLeave = false,
}: {
  record: AttendanceRecord | null;
  pending: PunchOutCorrectionRequest | null;
  onLeave?: boolean;
}) {
  const { primary, arrival, leave } = teamAttendanceStatusLayers({
    record,
    hasPendingCorrection: pending?.status === "pending",
    onLeave,
  });
  const title = teamAttendanceStatusLabel({
    record,
    hasPendingCorrection: pending?.status === "pending",
    onLeave,
  });

  function renderPill(tag: TeamAttendanceStatusTag) {
    return (
      <span
        key={tag}
        className={`w-fit rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] ${teamAttendanceStatusTagClass(tag)}`}
      >
        {tag}
      </span>
    );
  }

  return (
    <div
      title={title}
      className="my-auto flex flex-col items-start gap-1 text-left"
    >
      {primary.length > 0 ? (
        <div className="flex flex-wrap items-center justify-start gap-1">
          {primary.map(tag => renderPill(tag))}
        </div>
      ) : null}
      {arrival ? (
        <div className="flex flex-wrap items-center justify-start gap-1">
          {renderPill(arrival)}
        </div>
      ) : null}
      {leave ? (
        <div className="flex flex-wrap items-center justify-start gap-1">
          {renderPill(leave)}
        </div>
      ) : null}
    </div>
  );
}

const TEAM_ACTIVITY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

type TeamActivityFilter = (typeof TEAM_ACTIVITY_OPTIONS)[number]["value"];

export function TeamAttendanceView({ businessDate }: { businessDate: string }) {
  const [workDate, setWorkDate] = useState(businessDate);
  const [activityFilter, setActivityFilter] =
    useState<TeamActivityFilter>("active");
  const teamAttendance = useTeamAttendance(workDate, true, activityFilter);
  const pendingRequests = usePendingPunchOutCorrectionRequests(undefined, true);
  const [reviewRequest, setReviewRequest] =
    useState<PunchOutCorrectionRequest | null>(null);
  const [manualTarget, setManualTarget] = useState<WorkspaceUser | null>(null);
  const [auditDetail, setAuditDetail] = useState<{
    employee: WorkspaceUser;
    attendance: AttendanceRecord;
  } | null>(null);

  const pendingForDate = useMemo(() => {
    return (pendingRequests.data ?? []).filter(
      item => item.workDate === workDate
    );
  }, [pendingRequests.data, workDate]);

  const pendingByAttendanceId = useMemo(() => {
    const map = new Map<string, PunchOutCorrectionRequest>();
    for (const item of pendingForDate) {
      if (item.attendanceId) map.set(item.attendanceId, item);
    }
    return map;
  }, [pendingForDate]);

  const pendingByUserId = useMemo(() => {
    const map = new Map<string, PunchOutCorrectionRequest>();
    for (const item of pendingForDate) {
      map.set(item.userId, item);
    }
    return map;
  }, [pendingForDate]);

  const pendingCorrections = pendingRequests.data ?? [];

  const rows = teamAttendance.data ?? [];
  const loading = teamAttendance.isLoading && !teamAttendance.data;
  const switchingDate =
    teamAttendance.isFetching && Boolean(teamAttendance.data);
  const error =
    teamAttendance.error instanceof Error ? teamAttendance.error.message : null;
  const present = rows.filter(row => row.attendance?.punchInAt).length;
  const onLeaveCount = rows.filter(row => row.onLeave).length;
  const absent = rows.filter(
    row => !row.attendance?.punchInAt && !row.onLeave
  ).length;

  if (loading) return <AttendanceSkeleton />;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
      <div className="border-b border-[#EAF0F2] bg-[#F8FAFB] p-5">
        <div className="overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-[#EAF0F2] px-4 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF3E4] text-[#A87532]">
              <ClipboardCheck className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
                Attendance corrections
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-extrabold text-[#173247]">
                  Pending review queue
                </h3>
                <span className="inline-flex items-center rounded-full bg-[#FFF5E7] px-2 py-0.5 text-[10px] font-extrabold text-[#A87532]">
                  {pendingCorrections.length} pending
                </span>
              </div>
            </div>
          </div>

          {pendingCorrections.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F2F6F7] text-[#8294A0]">
                <ClipboardCheck className="h-4 w-4" />
              </span>
              <p className="text-xs font-extrabold text-[#486170]">
                No pending corrections
              </p>
              <p className="max-w-xs text-[11px] font-medium leading-5 text-[#8294A0]">
                Employee punch correction requests will appear here for review.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#EEF3F5]">
              {pendingCorrections.map(item => {
                const typeMeta = correctionTypeMeta(item.correctionType);
                const TypeIcon = typeMeta.icon;
                const timePreview = correctionTimePreview(item);
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition hover:bg-[#FBFCFD]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF7F4] text-[10px] font-extrabold text-[#087A6D]">
                      {initials(
                        item.employeeName ?? null,
                        item.employeeEmail || ""
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-xs font-extrabold text-[#173247]">
                          {item.employeeName || item.employeeEmail || "—"}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] ${typeMeta.chip}`}
                        >
                          <TypeIcon className="h-3 w-3" />
                          {typeMeta.label}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-[#FFF5E7] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-[#A87532]">
                          Pending
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[#718494]">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3 w-3 text-[#92A1AA]" />
                          {formatDate(item.workDate)}
                        </span>
                        {timePreview ? (
                          <span className="text-[#536D7E]">{timePreview}</span>
                        ) : null}
                        {item.reason ? (
                          <span className="max-w-full truncate text-[#8294A0]">
                            {item.reason}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReviewRequest(item)}
                      className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#0E9384] px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white transition hover:bg-[#0a7d71]"
                    >
                      Review
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {error && (
        <p className="m-5 rounded-xl bg-[#FFF5F4] p-3 text-xs font-semibold text-[#A64D43]">
          {error}
        </p>
      )}
      <BusyOverlay active={switchingDate} label="Loading attendance…" />
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EAF0F2] p-5">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
            Team attendance
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D7EEE9] bg-[#F3FBFA] px-2.5 py-1 text-[11px] font-extrabold text-[#087A6D]">
              <span className="tabular-nums text-sm leading-none">
                {present}
              </span>
              Present
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5EDF0] bg-[#F7FAFB] px-2.5 py-1 text-[11px] font-extrabold text-[#5F7482]">
              <span className="tabular-nums text-sm leading-none">
                {absent}
              </span>
              Absent
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F0D7B0] bg-[#FDF2F8] px-2.5 py-1 text-[11px] font-extrabold text-[#9D174D]">
              <span className="tabular-nums text-sm leading-none">
                {onLeaveCount}
              </span>
              On Leave
            </span>
          </div>
          <p className="mt-2 text-xs font-medium text-[#718494]">
            Office hours: 9:00 AM–6:30 PM; On-time grace ends 9:15 AM.
          </p>
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-end gap-3">
          <label className="block min-w-[8.5rem]">
            <span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              Account
            </span>
            <ThemedSelect
              value={activityFilter}
              aria-label="Filter by account status"
              className="w-full"
              options={[...TEAM_ACTIVITY_OPTIONS]}
              onChange={value => setActivityFilter(value as TeamActivityFilter)}
            />
          </label>
          <label className="block min-w-[10.5rem]">
            <span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              Date
            </span>
            <div className="ds-date-wrap w-full">
              <input
                type="date"
                value={workDate}
                onChange={event => setWorkDate(event.target.value)}
                aria-label="Attendance date"
                className="ds-control"
              />
            </div>
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[1.2fr_160px_100px_100px_1.1fr_150px] gap-3 border-b border-[#EAF0F2] bg-gradient-to-b from-[#F8FAFB] to-[#F3F7F8] px-5 py-3.5 text-left text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#7890A0]">
            <span>Team member</span>
            <span>Status</span>
            <span>Punch in</span>
            <span>Punch out</span>
            <span>Device / IP</span>
            <span>Action</span>
          </div>
          {rows.map(({ user, attendance: record, onLeave }) => {
            const pending =
              (record ? pendingByAttendanceId.get(record.id) : null) ??
              pendingByUserId.get(user.id) ??
              null;
            const managed =
              isManagedPunchOutSource(resolvePunchOutSource(record ?? {})) ||
              isManagedPunchInSource(resolvePunchInSource(record ?? {}));
            return (
              <div
                key={user.id}
                className={`grid grid-cols-[1.2fr_160px_100px_100px_1.1fr_150px] gap-3 border-b border-[#EEF3F5] px-5 py-4 transition last:border-b-0 ${
                  !user.isActive
                    ? "bg-[#FFF8F7] shadow-[inset_3px_0_0_0_#C96B63] hover:bg-[#FFF1EF]"
                    : managed
                      ? "bg-[#FCFAF6] shadow-[inset_3px_0_0_0_#C9A66B] hover:bg-[#FBFCFD]"
                      : "hover:bg-[#FBFCFD]"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2.5 text-left">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${
                      user.isActive
                        ? "bg-[#EAF7F4] text-[#087A6D]"
                        : "bg-[#F2F4F5] text-[#8294A0]"
                    }`}
                  >
                    {initials(user.displayName, user.email)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <p className="truncate text-xs font-extrabold">
                        {user.displayName || user.email}
                      </p>
                      {!user.isActive ? (
                        <span className="inline-flex shrink-0 rounded-full bg-[#FFF1EF] px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#A64D43]">
                          Inactive
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[10px] font-medium text-[#8494A0]">
                      {user.email}
                    </p>
                  </div>
                </div>
                <TeamStatusPills
                  record={record}
                  pending={pending}
                  onLeave={onLeave}
                />
                <span className="my-auto text-left text-xs font-semibold text-[#536D7E]">
                  {record?.punchInAt ? formatTime(record.punchInAt) : "—"}
                </span>
                <span className="my-auto text-left text-xs font-semibold text-[#536D7E]">
                  {record?.punchOutAt ? formatTime(record.punchOutAt) : "—"}
                </span>
                <span
                  className="my-auto truncate text-left text-[10px] font-medium text-[#7D909D]"
                  title={record?.device?.userAgent || undefined}
                >
                  {record?.device?.ipAddress || "—"}
                  {record?.device?.userAgent
                    ? ` · ${record.device.userAgent.includes("Chrome") ? "Chrome" : record.device.userAgent.includes("Firefox") ? "Firefox" : record.device.userAgent.includes("Safari") ? "Safari" : record.device.userAgent.includes("Edge") ? "Edge" : "Browser"}`
                    : ""}
                </span>
                <div className="my-auto text-left">
                  <TeamActionCell
                    record={record}
                    pending={pending}
                    onReview={() => {
                      if (pending) setReviewRequest(pending);
                    }}
                    onManual={() => setManualTarget(user)}
                    onOpenAudit={() => {
                      if (record)
                        setAuditDetail({ employee: user, attendance: record });
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {reviewRequest ? (
        <ReviewCorrectionDialog
          request={reviewRequest}
          onClose={() => setReviewRequest(null)}
        />
      ) : null}
      {manualTarget ? (
        <ManualPunchOutDialog
          employee={manualTarget}
          workDate={workDate}
          onClose={() => setManualTarget(null)}
        />
      ) : null}
      {auditDetail ? (
        <PunchOutAuditDialog
          employee={auditDetail.employee}
          attendance={auditDetail.attendance}
          onClose={() => setAuditDetail(null)}
        />
      ) : null}
    </section>
  );
}

type AttendanceView = "self" | "team";

function ManagerAttendanceTabs({
  value,
  onChange,
}: {
  value: AttendanceView;
  onChange: (next: AttendanceView) => void;
}) {
  function onKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    tab: AttendanceView
  ) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      onChange(tab === "self" ? "team" : "self");
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Attendance views"
      className="grid grid-cols-2 gap-1 border-b border-[#EAF0F2] sm:flex sm:gap-6"
    >
      {(
        [
          { id: "team" as const, label: "Team attendance" },
          { id: "self" as const, label: "Attendance · Self review" },
        ] as const
      ).map(tab => {
        const selected = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`attendance-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`attendance-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={event => onKeyDown(event, tab.id)}
            className={`relative px-2 py-2.5 text-center text-xs font-semibold transition sm:px-0 sm:text-left ${
              selected
                ? "font-extrabold text-[#0E9384]"
                : "text-[#718494] hover:text-[#486170]"
            }`}
          >
            {tab.label}
            {selected ? (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#0E9384]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function AttendanceModule({
  user,
  role,
  attendance,
  businessDate,
  canViewTeam,
}: {
  user?: WorkspaceUser | null;
  role?: WorkspaceUser["role"];
  attendance?: AttendanceRecord | null;
  businessDate: string;
  canViewTeam: boolean;
}) {
  void attendance;
  const resolvedRole =
    role ?? user?.role ?? (canViewTeam ? "admin" : "developer");
  const [attendanceView, setAttendanceView] = useState<AttendanceView>("team");

  if (resolvedRole === "developer" || !canViewTeam) {
    return <SelfAttendanceLedger />;
  }

  if (resolvedRole === "admin") {
    return <TeamAttendanceView businessDate={businessDate} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
          Attendance ledger
        </p>
        <h2 className="mt-1 text-lg font-extrabold text-[#173247]">
          Track your attendance or monitor your team&apos;s attendance.
        </h2>
      </div>

      <ManagerAttendanceTabs
        value={attendanceView}
        onChange={setAttendanceView}
      />

      <div
        role="tabpanel"
        id={`attendance-panel-${attendanceView}`}
        aria-labelledby={`attendance-tab-${attendanceView}`}
      >
        {attendanceView === "self" ? (
          <SelfAttendanceLedger />
        ) : (
          <TeamAttendanceView businessDate={businessDate} />
        )}
      </div>
    </div>
  );
}
