"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, LogOut, X } from "lucide-react";
import type { AttendanceRecord, PunchAction } from "@/types/api.types";

export function AttendancePill({
  attendance,
  isBusy,
  onPunch,
  punchOutBlockedMessage = null,
  onPunchOutBlocked,
}: {
  attendance: AttendanceRecord | null;
  isBusy: boolean;
  onPunch: (action: PunchAction) => void | Promise<unknown>;
  /** When set, punch-out shows this error instead of opening the confirm dialog. */
  punchOutBlockedMessage?: string | null;
  onPunchOutBlocked?: (message: string) => void;
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const mode = !attendance
    ? "punch_in"
    : attendance.state === "working"
      ? "punch_out"
      : "closed";
  const buttonLabel =
    mode === "punch_in"
      ? "Punch in"
      : mode === "punch_out"
        ? "Punch out"
        : "Day closed";
  const statusLabel = !attendance
    ? "Not punched in"
    : `${attendance.classification === "on_time" ? "On time" : "Late"} · ${attendance.state === "working" ? "Working" : "Punched out"}`;

  const shellClass =
    mode === "punch_in"
      ? "border-[#C5E8E1] bg-[#F3FBFA]"
      : mode === "punch_out"
        ? "border-[#F2D4B8] bg-[#FFF8F0]"
        : "border-[#E4EAED] bg-[#F7F9FA]";

  const labelClass =
    mode === "punch_in"
      ? "text-[#0A7267]"
      : mode === "punch_out"
        ? "text-[#A65D1C]"
        : "text-[#6B7F8C]";

  const statusClass =
    mode === "punch_in"
      ? "text-[#087A6D]"
      : mode === "punch_out"
        ? "text-[#8A4F16]"
        : "text-[#5F7380]";

  const buttonClass =
    mode === "punch_in"
      ? "bg-[#0E9384] text-white shadow-[0_5px_14px_rgba(14,147,132,0.28)] hover:bg-[#087A6D]"
      : mode === "punch_out"
        ? "bg-[#C2410C] text-white shadow-[0_5px_14px_rgba(194,65,12,0.28)] hover:bg-[#9A3412]"
        : "bg-[#9AA8B2] text-white shadow-none";

  useEffect(() => {
    if (!isConfirmOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusy) {
        setIsConfirmOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isConfirmOpen, isBusy]);

  // Close confirm once punch-out completes (attendance leaves "working").
  useEffect(() => {
    if (mode !== "punch_out" && isConfirmOpen && !isBusy) {
      setIsConfirmOpen(false);
    }
  }, [mode, isConfirmOpen, isBusy]);

  function closeConfirm() {
    if (isBusy) return;
    setIsConfirmOpen(false);
  }

  function handleButtonClick() {
    if (mode === "closed") return;
    if (mode === "punch_out") {
      if (punchOutBlockedMessage) {
        onPunchOutBlocked?.(punchOutBlockedMessage);
        return;
      }
      setIsConfirmOpen(true);
      return;
    }
    void onPunch("punch_in");
  }

  async function confirmPunchOut() {
    try {
      await onPunch("punch_out");
    } finally {
      // Dialog closes via mode change on success; keep open on error.
    }
  }

  return (
    <>
      <div
        className={`flex items-center gap-3 rounded-xl border p-2 shadow-sm ${shellClass}`}
      >
        <div className="hidden sm:block">
          <p
            className={`text-[9px] font-extrabold uppercase tracking-[0.12em] ${labelClass}`}
          >
            Today
          </p>
          <p className={`mt-0.5 text-xs font-extrabold ${statusClass}`}>
            {statusLabel}
          </p>
        </div>
        <button
          type="button"
          disabled={isBusy || mode === "closed"}
          onClick={handleButtonClick}
          className={`rounded-lg px-3 py-2 text-xs font-extrabold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80 ${buttonClass}`}
        >
          {isBusy ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            buttonLabel
          )}
        </button>
      </div>

      {isConfirmOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-end justify-center bg-[#102a3a]/35 p-3 sm:items-center"
              role="presentation"
              onClick={isBusy ? undefined : closeConfirm}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="punch-out-confirm-title"
                aria-describedby="punch-out-confirm-description"
                className="w-full max-w-md rounded-2xl border border-[#E5EDF0] bg-white p-5 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#C2410C]">
                      Confirm punch out
                    </p>
                    <h3
                      id="punch-out-confirm-title"
                      className="mt-1 text-lg font-extrabold text-[#173247]"
                    >
                      Punch out for today?
                    </h3>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    disabled={isBusy}
                    onClick={closeConfirm}
                    className="rounded-lg p-1.5 text-[#8294A0] hover:bg-[#F4F7F9] disabled:opacity-60"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p
                  id="punch-out-confirm-description"
                  className="mt-3 text-sm font-medium leading-6 text-[#6A8191]"
                >
                  This will end your working day for today. You can cancel if
                  you still need to stay punched in.
                </p>
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={closeConfirm}
                    className="rounded-xl border border-[#DDE7EB] px-4 py-2.5 text-xs font-extrabold text-[#5F7482] hover:bg-[#F7FAFB] disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void confirmPunchOut()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C2410C] px-4 py-2.5 text-xs font-extrabold text-white hover:bg-[#9A3412] disabled:opacity-60"
                  >
                    {isBusy ? (
                      <>
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        Punching out…
                      </>
                    ) : (
                      <>
                        <LogOut className="h-3.5 w-3.5" />
                        Punch out
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
