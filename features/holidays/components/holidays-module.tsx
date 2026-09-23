"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, LoaderCircle, Trash2, X } from "lucide-react";
import { BusyOverlay } from "@/components/shared/action-loader";
import { EmptyState, ErrorState } from "@/components/shared/error-state";
import { TablePagination } from "@/components/shared/table-pagination";
import { ThemedSelect } from "@/components/shared/themed-select";
import {
  useCreateHoliday,
  useDeleteHoliday,
  useHolidaysPage,
} from "@/features/holidays/hooks/use-holidays";
import { AttendanceSkeleton } from "@/features/workspace/components/loading-skeletons";
import { formatDate } from "@/features/workspace/utils/format";
import { useListPagination } from "@/hooks/use-list-pagination";
import { holidayKindLabel, type HolidayKind } from "@/lib/holiday-rules";
import type { CompanyHoliday } from "@/types/api.types";

const KIND_OPTIONS = [
  { value: "holiday", label: "Holiday" },
  { value: "weekoff", label: "Week off" },
];

export function HolidaysModule({ businessDate }: { businessDate: string }) {
  const upcomingPage = useListPagination(`upcoming:${businessDate}`);
  const pastPage = useListPagination(`past:${businessDate}`);
  const upcomingQuery = useHolidaysPage(
    {
      range: "upcoming",
      asOf: businessDate,
      page: upcomingPage.pageQuery,
    },
    true,
  );
  const pastQuery = useHolidaysPage(
    {
      range: "past",
      asOf: businessDate,
      page: pastPage.pageQuery,
    },
    true,
  );
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();
  const [date, setDate] = useState(businessDate);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<HolidayKind>("holiday");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyHoliday | null>(null);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createHoliday.mutateAsync({ date, name, kind });
      setName("");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create holiday.",
      );
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setError(null);
    setBusyId(deleteTarget.id);
    try {
      await deleteHoliday.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete holiday.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (
    (upcomingQuery.isLoading && !upcomingQuery.data) ||
    (pastQuery.isLoading && !pastQuery.data)
  ) {
    return <AttendanceSkeleton />;
  }
  if (upcomingQuery.isError || pastQuery.isError) {
    return (
      <ErrorState
        message={
          upcomingQuery.error instanceof Error
            ? upcomingQuery.error.message
            : pastQuery.error instanceof Error
              ? pastQuery.error.message
              : "Could not load holidays."
        }
      />
    );
  }

  const listBusy =
    (upcomingQuery.isFetching && Boolean(upcomingQuery.data)) ||
    (pastQuery.isFetching && Boolean(pastQuery.data)) ||
    createHoliday.isPending ||
    Boolean(busyId);

  return (
    <div className="relative space-y-4">
      <BusyOverlay active={listBusy} label="Updating holidays…" />
      <section className="overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
        <div className="border-b border-[#EAF0F2] bg-gradient-to-b from-[#FBFCFD] to-white px-4 py-4 sm:px-5">
          <h3 className="text-base font-extrabold tracking-[-0.02em] text-[#173247]">
            Add holiday / week off
          </h3>
          <p className="mt-1 text-xs font-medium leading-5 text-[#718494]">
            Entries appear immediately on attendance calendar and list views.
          </p>
        </div>
        <form
          onSubmit={onCreate}
          className="grid gap-3 p-4 sm:grid-cols-[9.5rem_9.5rem_1fr_auto] sm:p-5"
        >
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              Type
            </span>
            <div className="mt-1">
              <ThemedSelect
                aria-label="Holiday type"
                value={kind}
                options={KIND_OPTIONS}
                onChange={(value) => setKind(value as HolidayKind)}
              />
            </div>
          </label>
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              Date
            </span>
            <input
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E5EDF0] px-3 py-2.5 text-xs font-semibold text-[#294354] outline-none focus:border-[#0E9384]"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              Name
            </span>
            <input
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={
                kind === "weekoff" ? "e.g. Saturday off" : "e.g. Diwali"
              }
              className="mt-1 w-full rounded-xl border border-[#E5EDF0] px-3 py-2.5 text-xs font-semibold text-[#294354] outline-none focus:border-[#0E9384]"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={createHoliday.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0E9384] px-4 py-2.5 text-xs font-extrabold text-white hover:bg-[#0a7d71] disabled:opacity-60 sm:w-auto"
            >
              {createHoliday.isPending ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Add
            </button>
          </div>
        </form>
        {error ? (
          <p className="border-t border-[#EAF0F2] px-4 py-3 text-xs font-semibold text-[#A64D43] sm:px-5">
            {error}
          </p>
        ) : null}
      </section>

      <HolidayListCard
        title="Upcoming"
        subtitle="Future and today"
        holidays={upcomingQuery.data?.items ?? []}
        total={upcomingQuery.data?.total ?? 0}
        paginationProps={upcomingPage.paginationProps(
          upcomingQuery.data?.total ?? 0,
        )}
        emptyTitle="No upcoming entries."
        emptyDetail="Add a holiday or week off above."
        busyId={busyId}
        onDelete={setDeleteTarget}
      />

      <HolidayListCard
        title="Past"
        subtitle="Historical records"
        holidays={pastQuery.data?.items ?? []}
        total={pastQuery.data?.total ?? 0}
        paginationProps={pastPage.paginationProps(pastQuery.data?.total ?? 0)}
        emptyTitle="No past entries."
        emptyDetail="Past holidays and week offs will appear here."
        busyId={busyId}
        onDelete={setDeleteTarget}
      />

      {deleteTarget ? (
        <DeleteHolidayDialog
          holiday={deleteTarget}
          busy={busyId === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}

function DeleteHolidayDialog({
  holiday,
  busy,
  onCancel,
  onConfirm,
}: {
  holiday: CompanyHoliday;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[#102a3a]/35 p-3 sm:items-center"
      role="presentation"
      onClick={busy ? undefined : onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-holiday-title"
        className="w-full max-w-md rounded-2xl border border-[#E5EDF0] bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#A64D43]">
              Confirm removal
            </p>
            <h3
              id="delete-holiday-title"
              className="mt-1 text-lg font-extrabold text-[#173247]"
            >
              Remove {holiday.name}?
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg p-1.5 text-[#8294A0] hover:bg-[#F4F7F9] disabled:opacity-60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm font-medium leading-6 text-[#6A8191]">
          This will permanently remove the{" "}
          {holidayKindLabel(holiday.kind).toLowerCase()} on{" "}
          <span className="font-extrabold text-[#294354]">
            {formatDate(holiday.date)}
          </span>
          . Attendance calendars will stop treating this date as a company
          holiday or week off.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-[#DDE7EB] px-4 py-2.5 text-xs font-extrabold text-[#5F7482] hover:bg-[#F7FAFB] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C96B63] px-4 py-2.5 text-xs font-extrabold text-white hover:bg-[#B85A52] disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function HolidayListCard({
  title,
  subtitle,
  holidays,
  total,
  paginationProps,
  emptyTitle,
  emptyDetail,
  busyId,
  onDelete,
}: {
  title: string;
  subtitle: string;
  holidays: CompanyHoliday[];
  total: number;
  paginationProps: {
    start: number;
    limit: number;
    total: number;
    onPageChange: (start: number) => void;
  };
  emptyTitle: string;
  emptyDetail: string;
  busyId: string | null;
  onDelete: (holiday: CompanyHoliday) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
      <div className="border-b border-[#EAF0F2] bg-gradient-to-b from-[#FBFCFD] to-white px-4 py-4 sm:px-5">
        <h3 className="text-base font-extrabold tracking-[-0.02em] text-[#173247]">
          {title}
        </h3>
        <p className="mt-1 text-xs font-medium leading-5 text-[#718494]">
          {subtitle}
        </p>
      </div>
      <div className="p-4 sm:p-5">
        {total === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={emptyTitle}
            detail={emptyDetail}
          />
        ) : (
          <div className="ds-data-table-wrap">
            <table className="ds-data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Added by</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((holiday) => (
                  <tr key={holiday.id}>
                    <td className="font-semibold text-[#173247]">
                      {formatDate(holiday.date)}
                    </td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                          holiday.kind === "weekoff"
                            ? "bg-[#F2F5F6] text-[#5F7482]"
                            : "bg-[#FFE9C9] text-[#9A5B1F]"
                        }`}
                      >
                        {holidayKindLabel(holiday.kind)}
                      </span>
                    </td>
                    <td className="font-semibold text-[#173247]">
                      {holiday.name}
                    </td>
                    <td>{holiday.createdByName || "—"}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        disabled={busyId === holiday.id}
                        onClick={() => onDelete(holiday)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#F0C9C4] bg-[#FFF8F7] px-2.5 py-1.5 text-[10px] font-extrabold text-[#A64D43] hover:bg-[#FFF1EF] disabled:opacity-60"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination {...paginationProps} />
          </div>
        )}
      </div>
    </section>
  );
}
