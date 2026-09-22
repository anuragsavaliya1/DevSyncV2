/** Context-preserving Manager/Admin employee review canvas for DevSync v2. */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  MessageSquare,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  EmployeeDetailSkeleton,
} from "@/features/workspace/components/loading-skeletons";
import { ActionLoader, BusyOverlay } from "@/components/shared/action-loader";
import {
  assignTask,
  addTaskRemark,
  deleteTask,
} from "@/features/tasks/api/tasks-api";
import { getTeamMemberDetail } from "@/features/team/api/team-api";
import { ThemedSelect } from "@/components/shared/themed-select";
import {
  formatTaskDueLabel,
  normalizeTaskPriority,
  TASK_PRIORITIES,
  taskDueMinDateKey,
  taskDueMinTimeForDate,
  taskPriorityLabel,
} from "@/lib/task-rules";
import type { AssignedTask, EmployeeDetail, Role } from "@/types/api.types";

type DetailData = EmployeeDetail;
type Range = "last_7_days" | "this_month" | "all_time";
type Employee = DetailData["employee"];

const PRIORITY_OPTIONS = TASK_PRIORITIES.map(value => ({
  value,
  label: taskPriorityLabel(value),
}));

const SEARCH_DEBOUNCE_MS = 350;
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});
const todayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const formatDate = (value: string) =>
  dateFormat.format(new Date(`${value}T12:00:00Z`));
const formatTime = (value: string | null) =>
  value ? timeFormat.format(new Date(value)) : "—";
const duration = (minutes: number) =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`
    : `${minutes}m`;
const employeeName = (employee: Employee) =>
  employee.displayName || employee.email;
const todayDateKey = () => todayKeyFormat.format(new Date());

export function EmployeeDetailCanvas({
  employeeId,
  viewerRole,
  onBack,
  onChanged,
  refreshKey = 0,
}: {
  employeeId: string;
  viewerRole: Role;
  onBack: () => void;
  onChanged: () => void;
  refreshKey?: number;
}) {
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [range, setRange] = useState<Range>("last_7_days");
  const [fromDateDraft, setFromDateDraft] = useState("");
  const [toDateDraft, setToDateDraft] = useState("");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [taskTab, setTaskTab] = useState<"pending" | "completed">("pending");
  const [assignDescription, setAssignDescription] = useState("");
  const [assignPriority, setAssignPriority] = useState<
    (typeof TASK_PRIORITIES)[number]
  >("medium");
  const [assignDueDate, setAssignDueDate] = useState(taskDueMinDateKey);
  const [assignDueTime, setAssignDueTime] = useState("");
  const minDueDate = taskDueMinDateKey();
  const minDueTime = taskDueMinTimeForDate(assignDueDate);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [remarkDrafts, setRemarkDrafts] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<AssignedTask | null>(null);
  const hasDetailRef = useRef(false);

  useEffect(() => {
    hasDetailRef.current = Boolean(detail);
  }, [detail]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(queryInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  const reload = useCallback(
    async (options?: { historyLoader?: boolean }) => {
      setError(null);
      const soft = hasDetailRef.current;
      if (!soft) {
        setIsLoading(true);
      } else if (options?.historyLoader) {
        setIsHistoryLoading(true);
      }
      try {
        setDetail(
          await getTeamMemberDetail(employeeId, {
            range,
            fromDate: appliedFromDate || undefined,
            toDate: appliedToDate || undefined,
            query: debouncedQuery || undefined,
          })
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load employee details."
        );
      } finally {
        setIsHistoryLoading(false);
        setIsLoading(false);
      }
    },
    [appliedFromDate, appliedToDate, debouncedQuery, employeeId, range]
  );

  useEffect(() => {
    void reload({ historyLoader: hasDetailRef.current });
  }, [reload, refreshKey]);

  function selectRange(nextRange: Range) {
    setRange(nextRange);
    setFromDateDraft("");
    setToDateDraft("");
    setAppliedFromDate("");
    setAppliedToDate("");
  }

  function applyDateFilter() {
    if (!fromDateDraft || !toDateDraft) {
      setError("Select both start and end dates before applying.");
      return;
    }
    if (fromDateDraft > toDateDraft) {
      setError("Start date cannot be after end date.");
      return;
    }
    setError(null);
    setRange("all_time");
    setAppliedFromDate(fromDateDraft);
    setAppliedToDate(toDateDraft);
  }

  function clearHistoryFilters() {
    setQueryInput("");
    setDebouncedQuery("");
    setFromDateDraft("");
    setToDateDraft("");
    setAppliedFromDate("");
    setAppliedToDate("");
    setRange("last_7_days");
    setError(null);
  }

  async function run(action: () => Promise<void>, successMessage?: string) {
    setIsBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await action();
      await reload({ historyLoader: false });
      onChanged();
      if (successMessage) setSuccess(successMessage);
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Action failed."
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function confirmDeleteTask() {
    if (!deleteTarget) return;
    const taskId = deleteTarget.id;
    await run(async () => {
      await deleteTask(taskId);
      if (expandedTaskId === taskId) {
        setExpandedTaskId(null);
      }
      setDeleteTarget(null);
    }, "Task deleted.");
  }

  const employee = detail?.employee;
  const visibleTasks = detail?.tasks[taskTab] || [];
  const todayKey = todayDateKey();
  const canApplyDates = Boolean(fromDateDraft && toDateDraft) && !isBusy;
  const hasActiveFilters = Boolean(
    queryInput.trim() ||
      appliedFromDate ||
      appliedToDate ||
      fromDateDraft ||
      toDateDraft
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-[#DDE7EB] bg-white px-3 py-2 text-xs font-extrabold text-[#526B7B] transition hover:border-[#AFCAC4] hover:text-[#087A6D]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        {employee && (
          <div
            className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] ${employee.isActive ? "bg-[#EAF7F4] text-[#087A6D]" : "bg-[#FFF1EF] text-[#A64D43]"}`}
          >
            {employee.isActive ? "Active employee" : "Inactive employee"}
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-[#F4C9C4] bg-[#FFF5F4] px-4 py-3 text-xs font-semibold text-[#A64D43]"
        >
          <X className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-[#CDE9E3] bg-[#F3FBF8] px-4 py-3 text-xs font-semibold text-[#087A6D]"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {success}
        </div>
      )}
      {isLoading && !detail ? (
        <EmployeeDetailSkeleton />
      ) : (
        detail && (
          <div className="relative space-y-5">
            <BusyOverlay active={isBusy} label="Saving…" />
            <section className="rounded-2xl border border-[#E1EAED] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF7F4] text-sm font-extrabold text-[#087A6D]">
                    {employeeName(detail.employee)
                      .split(" ")
                      .map(part => part[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
                      Employee operations
                    </p>
                    <h2 className="mt-1 truncate text-xl font-extrabold tracking-[-0.035em]">
                      {employeeName(detail.employee)}
                    </h2>
                    <p className="mt-1 truncate text-xs font-medium text-[#718494]">
                      {detail.employee.email} · {detail.employee.role}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Metric
                    label="Updates"
                    value={String(detail.summary.totalUpdates)}
                  />
                  <Metric
                    label="Hours"
                    value={duration(detail.summary.totalMinutes)}
                  />
                  <Metric
                    label="Open tasks"
                    value={String(detail.summary.pendingTasks)}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[#E1EAED] bg-white p-5 shadow-sm">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
                Assign a task
              </p>
              <div className="mt-3 space-y-3">
                <input
                  disabled={!detail.employee.isActive || isBusy}
                  value={assignDescription}
                  onChange={event => setAssignDescription(event.target.value)}
                  placeholder={
                    detail.employee.isActive
                      ? "What needs to be done?"
                      : "Inactive employees cannot receive new tasks"
                  }
                  className="h-10 w-full rounded-xl border border-[#DDE7EB] bg-[#F7F9FA] px-3 text-xs font-extrabold text-[#294354] outline-none placeholder:font-medium placeholder:text-[#8fa0ad] focus:border-[#0E9384] focus:bg-white disabled:cursor-not-allowed disabled:bg-[#F5F7F8]"
                />
                <div className="flex flex-wrap items-end gap-2">
                  <label className="block w-full min-w-[8.5rem] sm:w-[10rem]">
                    <span className="mb-1 block text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#8A9AA7]">
                      Priority
                    </span>
                    <ThemedSelect
                      aria-label="Priority"
                      className="w-full [&_button]:h-10 [&_button]:bg-[#F7F9FA]"
                      disabled={!detail.employee.isActive || isBusy}
                      value={assignPriority}
                      options={PRIORITY_OPTIONS}
                      onChange={value =>
                        setAssignPriority(
                          value as (typeof TASK_PRIORITIES)[number],
                        )
                      }
                    />
                  </label>
                  <label className="block w-full min-w-[9.75rem] sm:w-[11rem]">
                    <span className="mb-1 block text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#8A9AA7]">
                      Due date
                    </span>
                    <div className="ds-date-wrap w-full">
                      <input
                        type="date"
                        disabled={!detail.employee.isActive || isBusy}
                        value={assignDueDate}
                        min={minDueDate}
                        onChange={event => {
                          const nextDate = event.target.value;
                          setAssignDueDate(nextDate);
                          const nextMinTime = taskDueMinTimeForDate(nextDate);
                          if (
                            nextMinTime &&
                            assignDueTime &&
                            assignDueTime < nextMinTime
                          ) {
                            setAssignDueTime("");
                          }
                        }}
                        aria-label="Due date"
                        className="ds-control h-10 bg-[#F7F9FA]"
                      />
                    </div>
                  </label>
                  <label className="block w-full min-w-[9.75rem] sm:w-[11rem]">
                    <span className="mb-1 block text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#8A9AA7]">
                      Due time
                    </span>
                    <div className="ds-date-wrap w-full">
                      <input
                        type="time"
                        disabled={!detail.employee.isActive || isBusy}
                        value={assignDueTime}
                        min={minDueTime}
                        onChange={event => {
                          const nextTime = event.target.value;
                          const nextMinTime =
                            taskDueMinTimeForDate(assignDueDate);
                          if (
                            nextMinTime &&
                            nextTime &&
                            nextTime < nextMinTime
                          ) {
                            setError("Due time cannot be in the past.");
                            setAssignDueTime("");
                            return;
                          }
                          setAssignDueTime(nextTime);
                        }}
                        aria-label="Due time"
                        className="ds-control h-10 bg-[#F7F9FA]"
                      />
                    </div>
                  </label>
                  <button
                    disabled={
                      isBusy ||
                      !detail.employee.isActive ||
                      assignDescription.trim().length < 3 ||
                      !assignDueTime
                    }
                    onClick={() =>
                      void run(async () => {
                        await assignTask({
                          developerUserId: employeeId,
                          description: assignDescription,
                          priority: assignPriority,
                          dueDate: assignDueDate || null,
                          dueTime: assignDueTime || null,
                        });
                        setAssignDescription("");
                        setAssignPriority("medium");
                        setAssignDueDate(taskDueMinDateKey());
                        setAssignDueTime("");
                      }, "Task assigned and notification created.")
                    }
                    className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-xl bg-[#173247] px-5 text-xs font-extrabold whitespace-nowrap text-white transition hover:bg-[#21445E] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {isBusy ? (
                      <>
                        <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Assign task"
                    )}
                  </button>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAF0F2] p-5">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
                    Assigned tasks
                  </p>
                  <h3 className="mt-1 text-lg font-extrabold">Task review</h3>
                </div>
                <div className="flex rounded-lg bg-[#F2F6F7] p-1">
                  <button
                    onClick={() => setTaskTab("pending")}
                    className={`rounded-md px-2.5 py-1.5 text-[10px] font-extrabold ${taskTab === "pending" ? "bg-white text-[#173247] shadow-sm" : "text-[#7B8D99]"}`}
                  >
                    Pending · {detail.tasks.pending.length}
                  </button>
                  <button
                    onClick={() => setTaskTab("completed")}
                    className={`rounded-md px-2.5 py-1.5 text-[10px] font-extrabold ${taskTab === "completed" ? "bg-white text-[#173247] shadow-sm" : "text-[#7B8D99]"}`}
                  >
                    Completed · {detail.tasks.completed.length}
                  </button>
                </div>
              </div>
              <div className="divide-y divide-[#EEF3F5]">
                {visibleTasks.length ? (
                  visibleTasks.map(task => (
                    <article key={task.id} className="p-5">
                      <div className="flex gap-3">
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${task.status === "completed" ? "bg-[#EAF7F4] text-[#087A6D]" : "bg-[#F2F6F7] text-[#718494]"}`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p
                                className={`text-sm font-extrabold ${task.status === "completed" ? "text-[#718494] line-through" : "text-[#294354]"}`}
                              >
                                {task.description}
                              </p>
                              <p className="mt-1 text-[10px] font-semibold text-[#8496A1]">
                                {taskPriorityLabel(
                                  normalizeTaskPriority(task.priority),
                                )}
                                {(() => {
                                  const due = formatTaskDueLabel(task);
                                  return due ? ` · Due ${due}` : "";
                                })()}
                                {` · Assigned ${formatTime(task.assignedAt)}`}
                                {task.status === "completed"
                                  ? ` · Completed ${formatTime(task.completedAt)}`
                                  : " · Awaiting completion"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  setExpandedTaskId(
                                    expandedTaskId === task.id ? null : task.id
                                  )
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-extrabold text-[#087A6D] hover:bg-[#EAF7F4]"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                Remarks{" "}
                                {task.remarks.length
                                  ? `(${task.remarks.length})`
                                  : ""}
                              </button>
                              {viewerRole === "admin" && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => setDeleteTarget(task)}
                                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-extrabold text-[#A64D43] hover:bg-[#FFF1EF] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                          {expandedTaskId === task.id && (
                            <div className="mt-4 rounded-xl border border-[#E3ECEE] bg-[#FBFCFD] p-3">
                              <div className="space-y-2">
                                {task.remarks.length ? (
                                  task.remarks.map(remark => (
                                    <p
                                      key={remark.id}
                                      className="rounded-lg bg-white px-3 py-2 text-[11px] font-medium text-[#627A8B]"
                                    >
                                      <strong className="text-[#294354]">
                                        {remark.userName}:
                                      </strong>{" "}
                                      {remark.text}
                                    </p>
                                  ))
                                ) : (
                                  <p className="text-xs font-medium text-[#8797A2]">
                                    No remarks yet.
                                  </p>
                                )}
                              </div>
                              <div className="mt-3 flex gap-2">
                                <input
                                  value={remarkDrafts[task.id] || ""}
                                  onChange={event =>
                                    setRemarkDrafts(current => ({
                                      ...current,
                                      [task.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Add a remark…"
                                  className="min-w-0 flex-1 rounded-lg border border-[#DDE7EB] bg-white px-2.5 py-1.5 text-xs font-medium outline-none focus:border-[#0E9384]"
                                />
                                <button
                                  disabled={
                                    isBusy ||
                                    !(remarkDrafts[task.id] || "").trim()
                                  }
                                  onClick={() =>
                                    void run(async () => {
                                      await addTaskRemark(
                                        task.id,
                                        remarkDrafts[task.id]
                                      );
                                      setRemarkDrafts(current => ({
                                        ...current,
                                        [task.id]: "",
                                      }));
                                      setExpandedTaskId(null);
                                    })
                                  }
                                  className="cursor-pointer rounded-lg bg-[#EAF7F4] px-2.5 text-[10px] font-extrabold text-[#087A6D] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="p-8">
                    <Empty
                      title={`No ${taskTab} tasks`}
                      detail={
                        taskTab === "pending"
                          ? "New tasks assigned to this employee will appear here."
                          : "Completed tasks remain available for accountable review."
                      }
                    />
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[#E1EAED] bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
                    Work history
                  </p>
                  <h3 className="mt-1 text-lg font-extrabold">
                    Completed work and blockers
                  </h3>
                </div>
                <div className="flex flex-wrap gap-1 rounded-lg bg-[#F2F6F7] p-1">
                  {(["last_7_days", "this_month", "all_time"] as Range[]).map(
                    value => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => selectRange(value)}
                        className={`rounded-md px-2.5 py-1.5 text-[10px] font-extrabold ${range === value && !appliedFromDate && !appliedToDate ? "bg-white text-[#173247] shadow-sm" : "text-[#7B8D99]"}`}
                      >
                        {value === "last_7_days"
                          ? "Last 7 days"
                          : value === "this_month"
                            ? "This month"
                            : "All time"}
                      </button>
                    )
                  )}
                </div>
              </div>
              <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_160px_160px_auto]">
                <label className="flex items-center gap-2 rounded-xl border border-[#DDE7EB] px-3 py-2.5">
                  <Search className="h-4 w-4 text-[#8295A1]" />
                  <input
                    value={queryInput}
                    onChange={event => setQueryInput(event.target.value)}
                    placeholder="Search tasks or blockers"
                    className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none"
                  />
                </label>
                <div className="ds-date-wrap w-full">
                  <input
                    type="date"
                    value={fromDateDraft}
                    max={todayKey}
                    onChange={event => {
                      const nextFrom = event.target.value;
                      setFromDateDraft(nextFrom);
                      if (toDateDraft && nextFrom && toDateDraft < nextFrom) {
                        setToDateDraft("");
                      }
                    }}
                    aria-label="From date"
                    className="ds-control"
                  />
                </div>
                <div className="ds-date-wrap w-full">
                  <input
                    type="date"
                    value={toDateDraft}
                    min={fromDateDraft || undefined}
                    max={todayKey}
                    onChange={event => setToDateDraft(event.target.value)}
                    aria-label="To date"
                    className="ds-control"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!canApplyDates}
                    onClick={applyDateFilter}
                    className="inline-flex flex-1 items-center justify-center rounded-xl border border-[#B9DCD5] bg-[#F5FBF9] px-4 py-2 text-xs font-extrabold text-[#087A6D] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Apply
                  </button>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearHistoryFilters}
                      className="inline-flex items-center justify-center rounded-xl border border-[#DDE7EB] bg-white px-3 py-2 text-xs font-extrabold text-[#5F7482] hover:border-[#C5D4DA] hover:text-[#294354]"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {isHistoryLoading ? (
                  <ActionLoader label="Loading work history…" />
                ) : detail.updates.length ? (
                  detail.updates.map(update => (
                    <article
                      key={update.id}
                      className="overflow-hidden rounded-xl border border-[#E1EAED] bg-[#FBFCFD] shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAF0F2] bg-white px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF7F4] text-[#0E9384]">
                            <CalendarDays className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-[#173247]">
                              {formatDate(update.updateDate)}
                            </p>
                            <p className="mt-0.5 text-[10px] font-semibold text-[#8294A0]">
                              {update.tasks.length}{" "}
                              {update.tasks.length === 1 ? "task" : "tasks"}
                              {update.blockers ? " · Includes blocker" : ""}
                            </p>
                          </div>
                        </div>
                      </div>

                      <ul className="divide-y divide-[#EEF3F5]">
                        {update.tasks.map((task, index) => (
                          <li
                            key={task.id}
                            className="flex items-start gap-3 px-4 py-3"
                          >
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F2F6F7] text-[10px] font-extrabold text-[#5F7482]">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold leading-5 text-[#294354]">
                                {task.description}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-lg border border-[#E1EAED] bg-white px-2 py-1 text-[10px] font-extrabold text-[#486170]">
                              {duration(task.minutes)}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {update.blockers ? (
                        <div className="border-t border-[#F0E4D8] bg-[#FFF8F1] px-4 py-3">
                          <div className="flex gap-2.5">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F8E8D8] text-[#9B6943]">
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#9B6943]">
                                Blocker
                              </p>
                              <p className="mt-1 text-xs font-medium leading-5 text-[#7A5435]">
                                {update.blockers}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <Empty
                    title="No matching work history"
                    detail="Adjust the date or text filters to review another part of this employee’s recorded history."
                  />
                )}
              </div>
            </section>
          </div>
        )
      )}
      {deleteTarget ? (
        <DeleteTaskDialog
          task={deleteTarget}
          busy={isBusy}
          onCancel={() => {
            if (!isBusy) setDeleteTarget(null);
          }}
          onConfirm={() => void confirmDeleteTask()}
        />
      ) : null}
    </div>
  );
}

function DeleteTaskDialog({
  task,
  busy,
  onCancel,
  onConfirm,
}: {
  task: AssignedTask;
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
        aria-labelledby="delete-task-title"
        aria-describedby="delete-task-description"
        className="w-full max-w-md rounded-2xl border border-[#E5EDF0] bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#A64D43]">
              Confirm removal
            </p>
            <h3
              id="delete-task-title"
              className="mt-1 text-lg font-extrabold text-[#173247]"
            >
              Delete this task?
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
        <p
          id="delete-task-description"
          className="mt-3 text-sm font-medium leading-6 text-[#6A8191]"
        >
          This will permanently remove{" "}
          <span className="font-extrabold text-[#294354]">
            {task.description}
          </span>
          . Remarks on this task will also be deleted.
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E5EDF0] bg-[#FBFCFD] px-3 py-2 text-right">
      <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
        {label}
      </p>
      <p className="mt-1 text-sm font-extrabold text-[#294354]">{value}</p>
    </div>
  );
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#DDE7EA] bg-[#FBFCFD] px-4 py-8 text-center">
      <ClipboardList className="mx-auto h-5 w-5 text-[#0E9384]" />
      <p className="mt-3 text-xs font-extrabold text-[#486170]">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[11px] font-medium leading-5 text-[#8294A0]">
        {detail}
      </p>
    </div>
  );
}
