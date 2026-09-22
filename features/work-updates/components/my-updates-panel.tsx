"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { ActionLoader, BusyOverlay } from "@/components/shared/action-loader";
import { EmptyState } from "@/components/shared/error-state";
import { ThemedSelect } from "@/components/shared/themed-select";
import { useTasks } from "@/features/tasks/hooks/use-tasks";
import { useWorkUpdates } from "@/features/work-updates/hooks/use-work-updates";
import { duration, formatDate } from "@/features/workspace/utils/format";
import type { EmployeeHistoryRange } from "@/lib/employee-history-rules";
import {
  isPermittedWorkUpdateDate,
  previousDateKey,
} from "@/lib/operation-rules";
import {
  formatTaskDueLabel,
  normalizeTaskPriority,
  taskPriorityLabel,
} from "@/lib/task-rules";
import type {
  AssignedTask,
  AttendanceRecord,
  WorkUpdate,
} from "@/types/api.types";

export type DraftTask = {
  id: string;
  description: string;
  hours: string;
  minutes: string;
};

const MAX_TASK_MINUTES = 24 * 60;
const MAX_TASK_HOURS = 24;

const HISTORY_RANGE_OPTIONS: Array<{
  value: EmployeeHistoryRange;
  label: string;
}> = [
  { value: "last_7_days", label: "Last 7 days" },
  { value: "this_month", label: "This month" },
  { value: "all_time", label: "All time" },
];

export function draftTaskTotalMinutes(task: Pick<DraftTask, "hours" | "minutes">) {
  const hours = Number(task.hours.trim() || "0");
  const minutes = Number(task.minutes.trim() || "0");
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return NaN;
  return hours * 60 + minutes;
}

export function splitMinutesToDraft(totalMinutes: number) {
  const safe = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return {
    hours: hours > 0 ? String(hours) : "",
    minutes: hours > 0 || minutes > 0 ? String(minutes) : "",
  };
}

export function emptyDraftTask(id = crypto.randomUUID()): DraftTask {
  return { id, description: "", hours: "", minutes: "" };
}

export function MyUpdatesPanel({
  attendance,
  businessDate,
  workDate,
  setWorkDate,
  update,
  updates: _updates,
  tasks: _tasks,
  draftTasks,
  blockers,
  remarkText,
  isSubmittingUpdate,
  isTaskBusy,
  canEditUpdates,
  onDraftTasks,
  onBlockers,
  onRemarkText,
  onSubmit,
  onEditUpdate,
  onComplete,
  onAddRemark,
}: {
  attendance: AttendanceRecord | null;
  businessDate: string;
  workDate: string;
  setWorkDate: (value: string) => void;
  update: WorkUpdate | null;
  updates: WorkUpdate[];
  tasks: AssignedTask[];
  draftTasks: DraftTask[];
  blockers: string;
  remarkText: Record<string, string>;
  isSubmittingUpdate: boolean;
  isTaskBusy: boolean;
  canEditUpdates: boolean;
  onDraftTasks: (value: DraftTask[]) => void;
  onBlockers: (value: string) => void;
  onRemarkText: (value: Record<string, string>) => void;
  onSubmit: () => void;
  onEditUpdate: (update: WorkUpdate) => void;
  onComplete: (id: string) => void;
  onAddRemark: (id: string) => void;
}) {
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [historyRange, setHistoryRange] =
    useState<EmployeeHistoryRange>("last_7_days");
  const [taskRange, setTaskRange] =
    useState<EmployeeHistoryRange>("last_7_days");
  const yesterdayKey = previousDateKey(businessDate);

  const historyQuery = useWorkUpdates(true, { range: historyRange });
  const tasksQuery = useTasks(true, { range: taskRange });
  const filteredUpdates = historyQuery.data ?? [];
  const filteredTasks = tasksQuery.data ?? [];
  /** Action-only overlay — soft query refetches keep previous data (no second spinner). */
  const pageBusy = isSubmittingUpdate || isTaskBusy;
  const pageBusyLabel = isSubmittingUpdate ? "Saving update…" : "Updating…";


  const isDescriptionValid = (description: string) =>
    Boolean(description.trim());
  const isDurationValid = (task: DraftTask) => {
    const hoursRaw = task.hours.trim();
    const minutesRaw = task.minutes.trim();
    if (!hoursRaw && !minutesRaw) return false;
    const hours = Number(hoursRaw || "0");
    const minutes = Number(minutesRaw || "0");
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return false;
    if (hours < 0 || hours > MAX_TASK_HOURS) return false;
    if (minutes < 0 || minutes > 59) return false;
    if (hours === MAX_TASK_HOURS && minutes !== 0) return false;
    const total = hours * 60 + minutes;
    return total > 0 && total <= MAX_TASK_MINUTES;
  };
  const isTaskComplete = (task: DraftTask) =>
    isDescriptionValid(task.description) && isDurationValid(task);
  const canAttemptSubmit = Boolean(
    attendance && draftTasks.length && !isSubmittingUpdate,
  );
  const canAddAnotherTask =
    draftTasks.every(isTaskComplete) && !isSubmittingUpdate;

  function descriptionError(description: string) {
    if (!description.trim()) return "Task is required.";
    return null;
  }

  function durationError(task: DraftTask) {
    const hoursRaw = task.hours.trim();
    const minutesRaw = task.minutes.trim();
    if (!hoursRaw && !minutesRaw) return "Enter hours or minutes.";
    const hours = Number(hoursRaw || "0");
    const minutes = Number(minutesRaw || "0");
    if (!Number.isInteger(hours) || hours < 0 || hours > MAX_TASK_HOURS) {
      return "Hours must be 0–24.";
    }
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
      return "Minutes must be 0–59.";
    }
    if (hours === MAX_TASK_HOURS && minutes !== 0) {
      return "At 24 hours, minutes must be 0.";
    }
    const total = hours * 60 + minutes;
    if (total <= 0) return "Duration must be greater than zero.";
    if (total > MAX_TASK_MINUTES) return "Duration cannot exceed 24 hours.";
    return null;
  }

  function updateDraft(
    index: number,
    field: "description" | "hours" | "minutes",
    value: string
  ) {
    const nextTasks = draftTasks.map((task, taskIndex) => {
      if (taskIndex !== index) return task;
      if (field === "description") return { ...task, description: value };
      if (field === "hours") {
        return {
          ...task,
          hours: value.replace(/[^0-9]/g, "").slice(0, 2),
        };
      }
      return {
        ...task,
        minutes: value.replace(/[^0-9]/g, "").slice(0, 2),
      };
    });
    onDraftTasks(nextTasks);
    if (showFieldErrors && nextTasks.every(isTaskComplete)) {
      setShowFieldErrors(false);
    }
  }

  function handleSubmit() {
    if (draftTasks.some(task => !isTaskComplete(task))) {
      setShowFieldErrors(true);
      return;
    }
    setShowFieldErrors(false);
    onSubmit();
  }

  function handleEditUpdate(history: WorkUpdate) {
    setShowFieldErrors(false);
    onEditUpdate(history);
  }

  return (
    <div className="relative">
      <BusyOverlay active={pageBusy} label={pageBusyLabel} />
      <div className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
      <div className="space-y-5">
        <section className="overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EAF0F2] bg-gradient-to-b from-[#FBFCFD] to-white px-5 py-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
                Daily work update
              </p>
              <h2 className="mt-1 text-base font-extrabold tracking-[-0.02em] text-[#173247]">
                {update ? "Add more work or save edits" : "Log what you completed"}
              </h2>
            </div>
            <ThemedSelect
              aria-label="Work date"
              className="min-w-[13rem]"
              value={workDate}
              onChange={setWorkDate}
              options={[
                {
                  value: businessDate,
                  label: `Today · ${formatDate(businessDate)}`,
                },
                {
                  value: yesterdayKey,
                  label: `Yesterday · ${formatDate(yesterdayKey)}`,
                },
              ]}
            />
          </div>
          <div className="p-5">
          {!attendance && workDate === businessDate && (
            <div className="mt-4 rounded-xl border border-[#F2DFC0] bg-[#FFF9EF] px-3 py-2.5 text-xs font-semibold text-[#946D2B]">
              Punch In Required — punch in today before submitting today’s work
              update.
            </div>
          )}
          <div className="mt-5 space-y-3">
            {draftTasks.map((task, index) => {
              const taskMessage = showFieldErrors
                ? descriptionError(task.description)
                : null;
              const durationMessage = showFieldErrors
                ? durationError(task)
                : null;
              return (
                <div
                  key={task.id}
                  className="rounded-xl border border-[#E4ECEF] bg-[#FBFCFD] p-3"
                >
                  <div className="grid gap-2 sm:grid-cols-[1fr_72px_72px_auto]">
                    <div>
                      <input
                        value={task.description}
                        onChange={event =>
                          updateDraft(index, "description", event.target.value)
                        }
                        placeholder={`Task ${index + 1} completed`}
                        aria-label={`Task ${index + 1}`}
                        aria-invalid={Boolean(taskMessage)}
                        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#0E9384] ${taskMessage ? "border-[#F4C9C4]" : "border-[#DDE7EB]"}`}
                      />
                      {taskMessage && (
                        <p className="mt-1.5 text-[11px] font-semibold text-[#A64D43]">
                          {taskMessage}
                        </p>
                      )}
                    </div>
                    <div>
                      <input
                        value={task.hours}
                        onChange={event =>
                          updateDraft(index, "hours", event.target.value)
                        }
                        inputMode="numeric"
                        maxLength={2}
                        placeholder="Hr"
                        aria-label={`Hours for task ${index + 1}`}
                        aria-invalid={Boolean(durationMessage)}
                        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#0E9384] ${durationMessage ? "border-[#F4C9C4]" : "border-[#DDE7EB]"}`}
                      />
                    </div>
                    <div>
                      <input
                        value={task.minutes}
                        onChange={event =>
                          updateDraft(index, "minutes", event.target.value)
                        }
                        inputMode="numeric"
                        maxLength={2}
                        placeholder="Min"
                        aria-label={`Minutes for task ${index + 1}`}
                        aria-invalid={Boolean(durationMessage)}
                        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#0E9384] ${durationMessage ? "border-[#F4C9C4]" : "border-[#DDE7EB]"}`}
                      />
                    </div>
                    {draftTasks.length > 1 ? (
                      <button
                        type="button"
                        aria-label={`Remove task ${index + 1}`}
                        title="Remove task"
                        onClick={() =>
                          onDraftTasks(
                            draftTasks.filter(
                              (_, taskIndex) => taskIndex !== index
                            )
                          )
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#A64D43] hover:bg-[#FFF2F0]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="h-9 w-9" />
                    )}
                  </div>
                  {durationMessage ? (
                    <p className="mt-1.5 text-[11px] font-semibold text-[#A64D43]">
                      {durationMessage}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!canAddAnotherTask}
            onClick={() => onDraftTasks([...draftTasks, emptyDraftTask()])}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0E9384] hover:text-[#087A6D] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-[#0E9384]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add another task
          </button>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[0.11em] text-[#7890A0]">
              Blockers / notes{" "}
              <span className="normal-case tracking-normal">(optional)</span>
            </span>
            <textarea
              value={blockers}
              onChange={event => onBlockers(event.target.value)}
              placeholder="Detailed blockers or issues your team should know"
              rows={3}
              className="w-full resize-none rounded-xl border border-[#DDE7EB] px-3 py-2.5 text-sm font-medium outline-none focus:border-[#0E9384]"
            />
          </label>
          <button
            disabled={!canAttemptSubmit}
            onClick={handleSubmit}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0E9384] px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#087A6D] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmittingUpdate ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {update ? "Save update" : "Submit update"}
          </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAF0F2] bg-gradient-to-b from-[#FBFCFD] to-white px-5 py-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
                Work history
              </p>
              <h2 className="mt-1 text-base font-extrabold tracking-[-0.02em] text-[#173247]">
                Your submitted updates
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ThemedSelect
                aria-label="Work history range"
                className="w-[8.75rem]"
                value={historyRange}
                options={HISTORY_RANGE_OPTIONS}
                onChange={(value) =>
                  setHistoryRange(value as EmployeeHistoryRange)
                }
              />
              <span className="rounded-full bg-[#F3F7F8] px-2.5 py-1 text-[10px] font-extrabold text-[#658092]">
                {filteredUpdates.length}
                {historyRange === "all_time" ? " total" : ""}
              </span>
            </div>
          </div>
          <div className="relative space-y-3 p-5">
            {historyQuery.isLoading && !historyQuery.data ? (
              <ActionLoader label="Loading work history…" />
            ) : filteredUpdates.length ? (
              filteredUpdates.map(history => {
                const canEditThisUpdate =
                  canEditUpdates &&
                  isPermittedWorkUpdateDate(
                    history.updateDate,
                    businessDate,
                    yesterdayKey
                  );
                return (
                  <article
                    key={history.id}
                    className="overflow-hidden rounded-xl border border-[#E1EAED] bg-[#FBFCFD] shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAF0F2] bg-white px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF7F4] text-[#0E9384]">
                          <CalendarDays className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-[#173247]">
                            {formatDate(history.updateDate)}
                          </p>
                          <p className="mt-0.5 text-[10px] font-semibold text-[#8294A0]">
                            {history.tasks.length}{" "}
                            {history.tasks.length === 1 ? "task" : "tasks"}
                            {history.blockers ? " · Includes blocker" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canEditThisUpdate && (
                          <button
                            type="button"
                            onClick={() => handleEditUpdate(history)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-extrabold text-[#0E9384] hover:bg-[#EAF7F4]"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                    <ul className="divide-y divide-[#EEF3F5]">
                      {history.tasks.map((task, index) => (
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
                    {history.blockers ? (
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
                              {history.blockers}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <EmptyState
                icon={ClipboardList}
                title={
                  historyRange === "all_time"
                    ? "No updates submitted"
                    : "No updates in this range"
                }
                detail={
                  historyRange === "all_time"
                    ? "Your real work history appears after your first submission."
                    : "Try another range or switch to All time."
                }
              />
            )}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAF0F2] bg-gradient-to-b from-[#FBFCFD] to-white px-5 py-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
              Assigned tasks
            </p>
            <h2 className="mt-1 text-base font-extrabold tracking-[-0.02em] text-[#173247]">
              Your active queue
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemedSelect
              aria-label="Assigned tasks range"
              className="w-[8.75rem]"
              value={taskRange}
              options={HISTORY_RANGE_OPTIONS}
              onChange={(value) => setTaskRange(value as EmployeeHistoryRange)}
            />
            <span className="rounded-full bg-[#F3F7F8] px-2.5 py-1 text-[10px] font-extrabold text-[#658092]">
              {filteredTasks.length}
              {taskRange === "all_time" ? " total" : ""}
            </span>
          </div>
        </div>
        <div className="relative space-y-3 p-5">
          {tasksQuery.isLoading && !tasksQuery.data ? (
            <ActionLoader label="Loading assigned tasks…" />
          ) : filteredTasks.length ? (
            filteredTasks.map(task => (
              <article
                key={task.id}
                className={`rounded-xl border p-3.5 ${task.status === "completed" ? "border-[#DBECE8] bg-[#F6FCFA]" : "border-[#E6EEF0]"}`}
              >
                <div className="flex gap-3">
                  <button
                    type="button"
                    aria-label={
                      task.status === "completed"
                        ? "Completed"
                        : "Mark as Complete"
                    }
                    title={
                      task.status === "completed"
                        ? undefined
                        : "Mark as Complete"
                    }
                    disabled={task.status === "completed" || isTaskBusy}
                    onClick={() => onComplete(task.id)}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      task.status === "completed"
                        ? "cursor-default border-[#0E9384] bg-[#0E9384] text-white"
                        : "cursor-pointer border-[#B9CBD3] text-transparent hover:border-[#0E9384]"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-extrabold leading-5 ${
                        task.status === "completed"
                          ? "text-[#7B919C] line-through"
                          : "text-[#294354]"
                      }`}
                    >
                      {task.description}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold text-[#8A9AA7]">
                      {taskPriorityLabel(normalizeTaskPriority(task.priority))}
                      {(() => {
                        const due = formatTaskDueLabel(task);
                        return due ? ` · Due ${due}` : "";
                      })()}
                      {` · Assigned ${new Date(task.assignedAt).toLocaleDateString()}`}
                    </p>
                    {task.remarks.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {task.remarks.map(remark => (
                          <p
                            key={remark.id}
                            className="rounded-lg bg-white/80 px-2 py-1.5 text-[10px] font-medium text-[#6E8190]"
                          >
                            <strong>{remark.userName}:</strong> {remark.text}
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <input
                        value={remarkText[task.id] || ""}
                        onChange={event =>
                          onRemarkText({
                            ...remarkText,
                            [task.id]: event.target.value,
                          })
                        }
                        placeholder="Add a remark…"
                        className="min-w-0 flex-1 rounded-lg border border-[#DDE7EB] bg-white px-2.5 py-1.5 text-[11px] font-medium outline-none focus:border-[#0E9384]"
                      />
                      <button
                        disabled={
                          isTaskBusy || !(remarkText[task.id] || "").trim()
                        }
                        onClick={() => onAddRemark(task.id)}
                        className="cursor-pointer rounded-lg bg-[#EAF7F4] px-2.5 text-[10px] font-extrabold text-[#087A6D] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title={
                taskRange === "all_time"
                  ? "No assigned tasks"
                  : "No tasks in this range"
              }
              detail={
                taskRange === "all_time"
                  ? "Tasks assigned by a Manager or Admin appear in this live queue."
                  : "Try another range or switch to All time."
              }
            />
          )}
        </div>
      </section>
      </div>
    </div>
  );
}
