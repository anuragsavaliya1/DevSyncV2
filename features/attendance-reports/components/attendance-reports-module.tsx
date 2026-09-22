"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { EmptyState, ErrorState } from "@/components/shared/error-state";
import { ActionLoader, BusyOverlay } from "@/components/shared/action-loader";
import { ThemedSelect } from "@/components/shared/themed-select";
import { useTeamAttendance } from "@/features/attendance/hooks/use-attendance";
import {
  useAttendanceReport,
  useCreateAttendanceReportEntry,
  useDeleteAttendanceReportEntry,
  useUpdateAttendanceReportEntry,
} from "@/features/attendance-reports/hooks/use-attendance-reports";
import { exportAttendanceReportExcel } from "@/features/attendance-reports/utils/export-excel";
import { AttendanceSkeleton } from "@/features/workspace/components/loading-skeletons";
import { formatDate } from "@/features/workspace/utils/format";
import {
  addDaysToDateKey,
  formatMonthTitle,
  monthRangeKeys,
  shiftMonthKey,
  toIndiaDateKey,
} from "@/lib/attendance-month";
import {
  ATTENDANCE_REPORT_ACTIONS,
  assertAttendanceReportMonthRange,
} from "@/lib/attendance-report-rules";
import type {
  AttendanceReportAction,
  AttendanceReportEntry,
} from "@/types/api.types";

const ACTION_FILTER_OPTIONS = [
  { value: "all", label: "All Actions" },
  ...ATTENDANCE_REPORT_ACTIONS.map((action) => ({
    value: action,
    label: action,
  })),
];

function currentIndiaMonthKey() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function monthKeyFromDate(dateKey: string) {
  return dateKey.slice(0, 7);
}

function lastDateKeyOfMonth(monthKey: string) {
  const { toExclusive } = monthRangeKeys(monthKey);
  return addDaysToDateKey(toExclusive, -1);
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#E1EAED] bg-gradient-to-b from-white to-[#F8FAFB] px-4 py-3.5 shadow-sm">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8B9BA6]">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-extrabold tracking-tight text-[#173247]">
        {value}
      </p>
    </div>
  );
}

function MonthChevron({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
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
          onClick={() => onChange(shiftMonthKey(value, -1))}
          className="rounded-lg p-1 text-[#486170] hover:bg-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[8.5rem] text-center text-xs font-extrabold text-[#294354]">
          {formatMonthTitle(value)}
        </span>
        <button
          type="button"
          aria-label={`Next ${label}`}
          onClick={() => onChange(shiftMonthKey(value, 1))}
          className="rounded-lg p-1 text-[#486170] hover:bg-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function AttendanceReportsModule() {
  const today = toIndiaDateKey();
  const [fromMonth, setFromMonth] = useState(currentIndiaMonthKey);
  const [toMonth, setToMonth] = useState(currentIndiaMonthKey);
  const [employeeId, setEmployeeId] = useState("all");
  const [generatedQuery, setGeneratedQuery] = useState<{
    fromMonth: string;
    toMonth: string;
    employeeId: string | null;
  } | null>(null);
  const [actionFilter, setActionFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<AttendanceReportEntry | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [remarkDrafts, setRemarkDrafts] = useState<Record<string, string>>({});

  const teamAttendance = useTeamAttendance(today, true, "active");
  const enabled = Boolean(generatedQuery);
  const reportQuery = useAttendanceReport(generatedQuery, enabled);
  const createEntry = useCreateAttendanceReportEntry();
  const updateEntry = useUpdateAttendanceReportEntry();
  const deleteEntry = useDeleteAttendanceReportEntry();

  const report = reportQuery.data;
  const actionBusy =
    createEntry.isPending || updateEntry.isPending || deleteEntry.isPending;
  const softLoading =
    reportQuery.isFetching && Boolean(reportQuery.data) && !actionBusy;

  const employeeOptions = useMemo(() => {
    const fromTeam = (teamAttendance.data ?? []).map((row) => ({
      value: row.user.id,
      label: row.user.displayName?.trim() || row.user.email,
    }));
    const fromReport = (report?.employees ?? []).map((employee) => ({
      value: employee.id,
      label: employee.displayName?.trim() || employee.email,
    }));
    const byId = new Map<string, { value: string; label: string }>();
    for (const option of [...fromTeam, ...fromReport]) {
      if (!byId.has(option.value)) byId.set(option.value, option);
    }
    return [
      { value: "all", label: "All Employees" },
      ...[...byId.values()].sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [teamAttendance.data, report?.employees]);

  const filteredEntries = useMemo(() => {
    const entries = report?.entries ?? [];
    if (actionFilter === "all") return entries;
    return entries.filter((entry) => entry.action === actionFilter);
  }, [report?.entries, actionFilter]);

  const focusedEmployeeSummary = report?.employeeSummary[0] ?? null;
  const isSingleEmployee = Boolean(
    generatedQuery?.employeeId && report && report.employees.length <= 1,
  );

  function setFromMonthClamped(next: string) {
    setFromMonth(next);
    if (next > toMonth) setToMonth(next);
  }

  function setToMonthClamped(next: string) {
    setToMonth(next < fromMonth ? fromMonth : next);
  }

  async function generate() {
    setError(null);
    setExportMessage(null);
    setActionFilter("all");
    try {
      assertAttendanceReportMonthRange(fromMonth, toMonth);
    } catch (rangeError) {
      setError(
        rangeError instanceof Error
          ? rangeError.message
          : "Invalid month range.",
      );
      return;
    }
    const nextQuery = {
      fromMonth,
      toMonth,
      employeeId: employeeId === "all" ? null : employeeId,
    };
    if (
      generatedQuery &&
      generatedQuery.fromMonth === nextQuery.fromMonth &&
      generatedQuery.toMonth === nextQuery.toMonth &&
      generatedQuery.employeeId === nextQuery.employeeId
    ) {
      await reportQuery.refetch();
      return;
    }
    setGeneratedQuery(nextQuery);
  }

  async function refresh() {
    if (!generatedQuery) return;
    setError(null);
    try {
      await reportQuery.refetch();
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to generate attendance report. Please try again.",
      );
    }
  }

  async function onExport() {
    if (!report) return;
    setError(null);
    try {
      await exportAttendanceReportExcel(report);
      setExportMessage("Excel report exported successfully.");
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Could not export Excel.",
      );
    }
  }

  async function saveRemark(entry: AttendanceReportEntry) {
    const remark = remarkDrafts[entry.id] ?? entry.managerRemark;
    setError(null);
    try {
      await updateEntry.mutateAsync({
        month: monthKeyFromDate(entry.date),
        id: entry.id,
        managerRemark: remark,
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save remark.",
      );
    }
  }

  async function onDelete(entry: AttendanceReportEntry) {
    setError(null);
    try {
      await deleteEntry.mutateAsync({
        month: monthKeyFromDate(entry.date),
        id: entry.id,
      });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete entry.",
      );
    }
  }

  return (
    <div className="relative space-y-4">
      <BusyOverlay
        active={softLoading || actionBusy}
        label={actionBusy ? "Saving…" : "Updating report…"}
      />
      <section className="rounded-2xl border border-[#E5EDF0] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-[#294354]">
              Monthly Attendance Report
            </h3>
            <p className="mt-0.5 text-[11px] font-medium text-[#8B9BA6]">
              Exceptions from Attendance and approved Leave. Optionally focus
              one employee and any From–To month range.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <MonthChevron
              label="From"
              value={fromMonth}
              onChange={setFromMonthClamped}
            />
            <MonthChevron
              label="To"
              value={toMonth}
              onChange={setToMonthClamped}
            />
            <div className="inline-flex min-w-[12rem] flex-col gap-1">
              <span className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
                Employee
              </span>
              <ThemedSelect
                aria-label="Employee for report"
                value={employeeId}
                onChange={setEmployeeId}
                options={employeeOptions}
              />
            </div>
            <button
              type="button"
              onClick={() => void generate()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0E9384] px-3.5 py-2.5 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(14,147,132,0.22)] transition hover:bg-[#0a7d71]"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Generate Report
            </button>
            {report ? (
              <>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  disabled={reportQuery.isFetching}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D7EEE9] bg-[#F3FBFA] px-3 py-2.5 text-xs font-extrabold text-[#0E9384] disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${reportQuery.isFetching ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => void onExport()}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#E5EDF0] bg-white px-3 py-2.5 text-xs font-extrabold text-[#294354]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export Excel
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#E5EDF0] bg-white px-3 py-2.5 text-xs font-extrabold text-[#294354]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Entry
                </button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {error ? <ErrorState message={error} /> : null}
      {exportMessage ? (
        <p className="rounded-xl border border-[#D7EEE9] bg-[#F3FBFA] px-3 py-2 text-xs font-semibold text-[#0E9384]">
          {exportMessage}
        </p>
      ) : null}

      {!generatedQuery ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="Select months and generate the report"
          detail="Choose From/To months and optionally one employee, then Generate Report."
        />
      ) : reportQuery.isLoading && !report ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#8B9BA6]">
            Generating attendance report…
          </p>
          <AttendanceSkeleton />
        </div>
      ) : reportQuery.isFetching && !report ? (
        <ActionLoader label="Generating attendance report…" />
      ) : reportQuery.isError ? (
        <ErrorState
          message={
            reportQuery.error instanceof Error
              ? reportQuery.error.message
              : "Unable to generate attendance report. Please try again."
          }
        />
      ) : report ? (
        <>
          {!isSingleEmployee ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard
                label="Total Employees"
                value={report.summary.totalEmployees}
              />
              <StatCard
                label="Late Arrivals"
                value={report.summary.lateArrivals}
              />
              <StatCard
                label="Early Departures"
                value={report.summary.earlyDepartures}
              />
              <StatCard label="Leaves" value={report.summary.leaves} />
              <StatCard label="Absences" value={report.summary.absences} />
              <StatCard
                label="Missing Punches"
                value={report.summary.missingPunches}
              />
            </div>
          ) : null}

          {isSingleEmployee && focusedEmployeeSummary ? (
            <section className="overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
              <div className="border-b border-[#EAF0F2] bg-gradient-to-b from-[#FBFCFD] to-white px-4 py-4 sm:px-5">
                <h4 className="text-base font-extrabold tracking-[-0.02em] text-[#173247]">
                  {focusedEmployeeSummary.employeeName} · Full summary
                </h4>
                <p className="mt-1 text-xs font-medium text-[#718494]">
                  {report.monthLabel}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-7 sm:p-5">
                <StatCard
                  label="Working days"
                  value={focusedEmployeeSummary.workingDays}
                />
                <StatCard
                  label="Present"
                  value={focusedEmployeeSummary.present}
                />
                <StatCard label="Late Arrivals" value={focusedEmployeeSummary.late} />
                <StatCard label="Early Departures" value={focusedEmployeeSummary.early} />
                <StatCard label="Leave" value={focusedEmployeeSummary.leave} />
                <StatCard
                  label="Absent"
                  value={focusedEmployeeSummary.absent}
                />
                <StatCard
                  label="Missing Punch"
                  value={focusedEmployeeSummary.missingPunch}
                />
              </div>
              {report.monthSummaries?.length ? (
                <div className="border-t border-[#EAF0F2] p-4 sm:p-5">
                  <h5 className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
                    Monthly breakdown
                  </h5>
                  <div className="ds-data-table-wrap mt-3">
                    <table className="ds-data-table">
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Working days</th>
                          <th>Present</th>
                          <th>Late Arrivals</th>
                          <th>Early Departures</th>
                          <th>Leave</th>
                          <th>Absent</th>
                          <th>Missing Punch</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.monthSummaries.map((row) => (
                          <tr key={row.month}>
                            <td className="font-semibold text-[#173247]">
                              {row.monthLabel}
                            </td>
                            <td>{row.workingDays}</td>
                            <td>{row.present}</td>
                            <td>{row.late}</td>
                            <td>{row.early}</td>
                            <td>{row.leave}</td>
                            <td>{row.absent}</td>
                            <td>{row.missingPunch}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
              <div className="border-b border-[#EAF0F2] bg-gradient-to-b from-[#FBFCFD] to-white px-4 py-4 sm:px-5">
                <h4 className="text-base font-extrabold tracking-[-0.02em] text-[#173247]">
                  Employee Summary
                </h4>
                <p className="mt-1 text-xs font-medium text-[#718494]">
                  {report.monthLabel}
                </p>
              </div>
              <div className="p-4 sm:p-5">
                <div className="ds-data-table-wrap">
                  <table className="ds-data-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Working days</th>
                        <th>Present</th>
                        <th>Late Arrivals</th>
                        <th>Early Departures</th>
                        <th>Leave</th>
                        <th>Absent</th>
                        <th>Missing Punch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.employeeSummary.map((row) => (
                        <tr key={row.employeeId}>
                          <td className="font-semibold text-[#173247]">
                            {row.employeeName}
                          </td>
                          <td>{row.workingDays}</td>
                          <td>{row.present}</td>
                          <td>{row.late}</td>
                          <td>{row.early}</td>
                          <td>{row.leave}</td>
                          <td>{row.absent}</td>
                          <td>{row.missingPunch}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#EAF0F2] bg-gradient-to-b from-[#FBFCFD] to-white px-4 py-4 sm:px-5">
              <div>
                <h4 className="text-base font-extrabold tracking-[-0.02em] text-[#173247]">
                  Exception details
                </h4>
                <p className="mt-1 text-xs font-medium text-[#718494]">
                  {report.monthLabel}
                </p>
              </div>
              <ThemedSelect
                aria-label="Filter action"
                value={actionFilter}
                onChange={setActionFilter}
                options={ACTION_FILTER_OPTIONS}
              />
            </div>

            <div className="p-4 sm:p-5">
              {!filteredEntries.length ? (
                <EmptyState
                  icon={FileSpreadsheet}
                  title={`No attendance exceptions found for ${report.monthLabel}.`}
                  detail="Normal attendance days are omitted from this report."
                />
              ) : (
                <div className="ds-data-table-wrap">
                  <table className="ds-data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Employee</th>
                        <th>Action</th>
                        <th className="min-w-[10rem]">Details</th>
                        <th className="min-w-[12rem]">Manager Remark</th>
                        <th>Source</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td className="whitespace-nowrap font-semibold text-[#173247]">
                            {formatDate(entry.date)}
                          </td>
                          <td className="font-semibold text-[#173247]">
                            {entry.employeeName}
                          </td>
                          <td>{entry.action}</td>
                          <td className="text-[#486170]">{entry.details}</td>
                          <td>
                            <div className="flex gap-1">
                              <input
                                value={
                                  remarkDrafts[entry.id] ?? entry.managerRemark
                                }
                                onChange={(event) =>
                                  setRemarkDrafts((drafts) => ({
                                    ...drafts,
                                    [entry.id]: event.target.value,
                                  }))
                                }
                                onBlur={() => void saveRemark(entry)}
                                placeholder="Add remark"
                                className="w-full min-w-[9rem] rounded-lg border border-[#E5EDF0] px-2 py-1.5 text-xs"
                              />
                            </div>
                          </td>
                          <td className="capitalize text-[#8B9BA6]">
                            {entry.source}
                          </td>
                          <td>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                aria-label="Edit entry"
                                onClick={() => setEditing(entry)}
                                className="rounded-lg p-1.5 text-[#486170] hover:bg-[#F7FAFB]"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label="Delete entry"
                                onClick={() => void onDelete(entry)}
                                className="rounded-lg p-1.5 text-[#A64D43] hover:bg-[#FFF8F7]"
                              >
                                {deleteEntry.isPending ? (
                                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}

      {showAdd && report && generatedQuery ? (
        <EntryModal
          title="Add Entry"
          employees={
            report.employees.length
              ? report.employees
              : employeeOptions
                  .filter((option) => option.value !== "all")
                  .map((option) => ({
                    id: option.value,
                    displayName: option.label,
                    email: option.label,
                  }))
          }
          fromMonth={generatedQuery.fromMonth}
          toMonth={generatedQuery.toMonth}
          initial={{
            date: `${generatedQuery.toMonth}-01`,
            employeeId:
              generatedQuery.employeeId ||
              report.employees[0]?.id ||
              employeeOptions.find((option) => option.value !== "all")
                ?.value ||
              "",
            action: "Other",
            details: "",
            managerRemark: "",
          }}
          busy={createEntry.isPending}
          onClose={() => setShowAdd(false)}
          onSubmit={async (values) => {
            setError(null);
            try {
              await createEntry.mutateAsync({
                month: monthKeyFromDate(values.date),
                ...values,
              });
              setShowAdd(false);
              await reportQuery.refetch();
            } catch (createError) {
              setError(
                createError instanceof Error
                  ? createError.message
                  : "Could not add entry.",
              );
            }
          }}
        />
      ) : null}

      {editing && report && generatedQuery ? (
        <EntryModal
          title="Edit Entry"
          employees={report.employees}
          fromMonth={monthKeyFromDate(editing.date)}
          toMonth={monthKeyFromDate(editing.date)}
          lockIdentity
          initial={{
            date: editing.date,
            employeeId: editing.employeeId,
            action: editing.action,
            details: editing.details,
            managerRemark: editing.managerRemark,
          }}
          busy={updateEntry.isPending}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            setError(null);
            try {
              await updateEntry.mutateAsync({
                month: monthKeyFromDate(editing.date),
                id: editing.id,
                action: values.action,
                details: values.details,
                managerRemark: values.managerRemark,
              });
              setEditing(null);
              await reportQuery.refetch();
            } catch (editError) {
              setError(
                editError instanceof Error
                  ? editError.message
                  : "Could not update entry.",
              );
            }
          }}
        />
      ) : null}
    </div>
  );
}

function EntryModal({
  title,
  employees,
  fromMonth,
  toMonth,
  initial,
  lockIdentity,
  busy,
  onClose,
  onSubmit,
}: {
  title: string;
  employees: Array<{ id: string; displayName: string | null; email: string }>;
  fromMonth: string;
  toMonth: string;
  initial: {
    date: string;
    employeeId: string;
    action: AttendanceReportAction;
    details: string;
    managerRemark: string;
  };
  lockIdentity?: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: {
    date: string;
    employeeId: string;
    action: AttendanceReportAction;
    details: string;
    managerRemark: string;
  }) => Promise<void>;
}) {
  const [date, setDate] = useState(initial.date);
  const [employeeId, setEmployeeId] = useState(initial.employeeId);
  const [action, setAction] = useState<AttendanceReportAction>(initial.action);
  const [details, setDetails] = useState(initial.details);
  const [managerRemark, setManagerRemark] = useState(initial.managerRemark);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit({ date, employeeId, action, details, managerRemark });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102A3A]/35 p-4">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="w-full max-w-md rounded-2xl border border-[#E5EDF0] bg-white p-5 shadow-xl"
      >
        <h3 className="text-sm font-extrabold text-[#294354]">{title}</h3>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              Date
            </span>
            <input
              type="date"
              min={`${fromMonth}-01`}
              max={lastDateKeyOfMonth(toMonth)}
              value={date}
              disabled={lockIdentity}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E5EDF0] px-3 py-2 text-sm disabled:bg-[#F7FAFB]"
              required
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              Employee
            </span>
            <select
              value={employeeId}
              disabled={lockIdentity}
              onChange={(event) => setEmployeeId(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E5EDF0] px-3 py-2 text-sm disabled:bg-[#F7FAFB]"
              required
            >
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.displayName?.trim() || employee.email}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              Action
            </span>
            <select
              value={action}
              onChange={(event) =>
                setAction(event.target.value as AttendanceReportAction)
              }
              className="mt-1 w-full rounded-xl border border-[#E5EDF0] px-3 py-2 text-sm"
            >
              {ATTENDANCE_REPORT_ACTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              Details
            </span>
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-[#E5EDF0] px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              Manager Remark
            </span>
            <input
              value={managerRemark}
              onChange={(event) => setManagerRemark(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E5EDF0] px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#E5EDF0] px-3 py-2 text-xs font-extrabold text-[#486170]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0E9384] px-3.5 py-2 text-xs font-extrabold text-white disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
