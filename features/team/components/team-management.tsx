/** Manager/Admin team status and access-control surfaces for DevSync v2. */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  List,
  LoaderCircle,
  Trash2,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react";
import { BusyOverlay } from "@/components/shared/action-loader";
import { useAssignTask } from "@/features/tasks/hooks/use-tasks";
import { ThemedSelect } from "@/components/shared/themed-select";
import { previousDateKey } from "@/lib/operation-rules";
import {
  TASK_PRIORITIES,
  taskDueMinDateKey,
  taskDueMinTimeForDate,
  taskPriorityLabel,
} from "@/lib/task-rules";
import type { Role, TeamMember, WorkspaceUser } from "@/types/api.types";

type User = WorkspaceUser;

const PRIORITY_OPTIONS = TASK_PRIORITIES.map(value => ({
  value,
  label: taskPriorityLabel(value),
}));

const ROLE_OPTIONS = [
  {
    value: "developer",
    label: "Developer",
    description: "Submit updates and complete tasks",
  },
  {
    value: "manager",
    label: "Manager",
    description: "Review team status and assign work",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Full access including role management",
  },
] as const;

const initials = (name: string | null, email: string) =>
  (name || email)
    .split(" ")
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
const duration = (minutes: number) =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`
    : `${minutes}m`;

const TEAM_ACTIVITY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

type TeamActivityFilter = (typeof TEAM_ACTIVITY_OPTIONS)[number]["value"];

export function TeamStatusCanvas({
  members,
  businessDate,
  workDate,
  setWorkDate,
  activityFilter,
  onActivityFilterChange,
  onOpenEmployee,
  onAssigned,
}: {
  members: TeamMember[];
  businessDate: string;
  workDate: string;
  setWorkDate: (value: string) => void;
  activityFilter: TeamActivityFilter;
  onActivityFilterChange: (value: TeamActivityFilter) => void;
  onOpenEmployee: (userId: string) => void;
  onAssigned: () => void;
}) {
  const [view, setView] = useState<"list" | "grid">("list");
  const [developerUserId, setDeveloperUserId] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<(typeof TASK_PRIORITIES)[number]>(
    "medium",
  );
  const [dueDate, setDueDate] = useState(taskDueMinDateKey);
  const [dueTime, setDueTime] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const assigneeRef = useRef<HTMLDivElement>(null);
  const assignTaskMutation = useAssignTask();
  const minDueDate = taskDueMinDateKey();
  const minDueTime = taskDueMinTimeForDate(dueDate);
  const yesterdayKey = previousDateKey(businessDate);
  const isTodaySelected = workDate === businessDate;
  const isYesterdaySelected = workDate === yesterdayKey;
  const submitted = members.filter(member => member.update).length;
  const assigneeOptions = members.filter(
    member => member.user.isActive && member.user.role !== "admin"
  );

  useEffect(() => {
    if (!isAssigneeOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (
        assigneeRef.current &&
        !assigneeRef.current.contains(event.target as Node)
      ) {
        setIsAssigneeOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsAssigneeOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isAssigneeOpen]);

  async function assign() {
    setIsAssigning(true);
    setMessage(null);
    try {
      await assignTaskMutation.mutateAsync({
        developerUserId,
        description,
        priority,
        dueDate: dueDate || null,
        dueTime: dueTime || null,
      });
      setDescription("");
      setDeveloperUserId("");
      setPriority("medium");
      setDueDate(taskDueMinDateKey());
      setDueTime("");
      setMessage("Task assigned and notification created.");
      onAssigned();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Task could not be assigned."
      );
    } finally {
      setIsAssigning(false);
    }
  }

  return (
    <div className="space-y-5">
     
      <section className="rounded-2xl border border-[#E1EAED] bg-white p-5 shadow-sm">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
          Assign new task
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-[240px_minmax(0,1fr)] md:items-end">
          <div className="relative" ref={assigneeRef}>
            <span className="mb-1 block text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#8A9AA7]">
              Assignee
            </span>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={isAssigneeOpen}
              aria-label="Assignee"
              onClick={() => setIsAssigneeOpen(open => !open)}
              className="ds-listbox-trigger flex h-10 w-full items-center justify-between gap-2 bg-[#F7F9FA] px-3 text-left outline-none"
            >
              <span className="min-w-0 truncate text-xs font-extrabold text-[#294354]">
                {assigneeOptions.find(({ user }) => user.id === developerUserId)
                  ?.user.displayName ||
                  assigneeOptions.find(({ user }) => user.id === developerUserId)
                    ?.user.email ||
                  "Select employee"}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-[#718494] transition ${isAssigneeOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isAssigneeOpen && (
              <div
                role="listbox"
                className="ds-listbox absolute z-30 mt-2 max-h-64 w-full overflow-y-auto"
              >
                {assigneeOptions.map(({ user }) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={developerUserId === user.id}
                    key={user.id}
                    onClick={() => {
                      setDeveloperUserId(user.id);
                      setIsAssigneeOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-[#F2F8F6] aria-selected:bg-[#EAF7F4]"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EAF7F4] text-[9px] font-extrabold text-[#087A6D]">
                      {initials(user.displayName, user.email)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-extrabold text-[#294354]">
                        {user.displayName || user.email}
                      </span>
                      <span className="block truncate text-[9px] font-medium text-[#8294A0]">
                        {user.email}
                      </span>
                    </span>
                    {developerUserId === user.id && (
                      <Check className="h-4 w-4 text-[#0E9384]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <label className="block min-w-0">
            <span className="mb-1 block text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#8A9AA7]">
              Task description
            </span>
            <input
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="What needs to be done?"
              className="h-10 w-full rounded-xl border border-[#DDE7EB] bg-[#F7F9FA] px-3 text-xs font-extrabold text-[#294354] outline-none placeholder:font-medium placeholder:text-[#8fa0ad] focus:border-[#0E9384] focus:bg-white"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block w-full min-w-[8.5rem] sm:w-[10rem]">
            <span className="mb-1 block text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#8A9AA7]">
              Priority
            </span>
            <ThemedSelect
              aria-label="Priority"
              className="w-full [&_button]:h-10 [&_button]:bg-[#F7F9FA]"
              value={priority}
              options={PRIORITY_OPTIONS}
              onChange={value =>
                setPriority(value as (typeof TASK_PRIORITIES)[number])
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
                value={dueDate}
                min={minDueDate}
                onChange={event => {
                  const nextDate = event.target.value;
                  setDueDate(nextDate);
                  const nextMinTime = taskDueMinTimeForDate(nextDate);
                  if (
                    nextMinTime &&
                    dueTime &&
                    dueTime < nextMinTime
                  ) {
                    setDueTime("");
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
                value={dueTime}
                min={minDueTime}
                onChange={event => {
                  const nextTime = event.target.value;
                  const nextMinTime = taskDueMinTimeForDate(dueDate);
                  if (nextMinTime && nextTime && nextTime < nextMinTime) {
                    setMessage("Due time cannot be in the past.");
                    setDueTime("");
                    return;
                  }
                  setDueTime(nextTime);
                }}
                aria-label="Due time"
                className="ds-control h-10 bg-[#F7F9FA]"
              />
            </div>
          </label>
          <button
            disabled={
              isAssigning ||
              !developerUserId ||
              description.trim().length < 3 ||
              !dueTime
            }
            onClick={() => void assign()}
            className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-xl bg-[#173247] px-5 text-xs font-extrabold whitespace-nowrap text-white transition hover:bg-[#21445E] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {isAssigning ? (
              <>
                <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />
                Assigning…
              </>
            ) : (
              "Assign Task"
            )}
          </button>
        </div>
        {message && (
          <p className="mt-2 text-xs font-semibold text-[#087A6D]">{message}</p>
        )}
      </section>
      <section className="rounded-2xl border border-[#E1EAED] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
              Compliance view
            </p>
            <p className="mt-1 text-sm font-extrabold">
              {submitted} submitted · {members.length - submitted} pending
            </p>
          </div>
          <div className="flex rounded-lg bg-[#F2F6F7] p-1">
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="List view"
              className={`rounded-md p-1.5 ${view === "list" ? "bg-white text-[#173247] shadow-sm" : "text-[#7B8D99]"}`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label="Grid view"
              className={`rounded-md p-1.5 ${view === "grid" ? "bg-white text-[#173247] shadow-sm" : "text-[#7B8D99]"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end lg:justify-end">
          <label className="block min-w-0 sm:min-w-[8.5rem] lg:w-[9rem]">
            <span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              Account
            </span>
            <ThemedSelect
              value={activityFilter}
              aria-label="Filter by account status"
              className="w-full"
              options={[...TEAM_ACTIVITY_OPTIONS]}
              onChange={(value) =>
                onActivityFilterChange(value as TeamActivityFilter)
              }
            />
          </label>

          <div className="min-w-0 lg:w-auto">
            <span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              Quick date
            </span>
            <div className="inline-flex w-full rounded-lg border border-[#DDE7EB] p-0.5 text-[10px] font-extrabold lg:w-auto">
              <button
                type="button"
                onClick={() => setWorkDate(yesterdayKey)}
                className={`min-w-0 flex-1 rounded-md px-3 py-2 lg:flex-none ${isYesterdaySelected ? "bg-[#EAF7F4] text-[#087A6D]" : "text-[#718494] hover:bg-[#F2F6F7]"}`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setWorkDate(businessDate)}
                className={`min-w-0 flex-1 rounded-md px-3 py-2 lg:flex-none ${isTodaySelected ? "bg-[#EAF7F4] text-[#087A6D]" : "text-[#718494] hover:bg-[#F2F6F7]"}`}
              >
                Today
              </button>
            </div>
          </div>

          <label className="block min-w-0 sm:col-span-2 sm:max-w-[12rem] lg:col-span-1 lg:w-[10.5rem]">
            <span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#8B9BA6]">
              Date
            </span>
            <div className="ds-date-wrap w-full max-w-full">
              <input
                type="date"
                value={workDate}
                onChange={event => setWorkDate(event.target.value)}
                aria-label="Work date"
                className="ds-control"
              />
            </div>
          </label>
        </div>
      </section>
      {view === "list" ? (
        <section className="overflow-x-auto rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
          <div className="min-w-[880px]">
            <div className="grid grid-cols-[1.1fr_90px_90px_1.35fr_160px] gap-4 border-b border-[#EAF0F2] bg-[#F8FAFB] px-5 py-3 text-left text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#7890A0]">
              <span>Developer</span>
              <span>Status</span>
              <span>Hours</span>
              <span>Tasks & blockers</span>
              <span>Review</span>
            </div>
            {members.map(({ user, update }) => (
              <div
                key={user.id}
                className={`grid grid-cols-[1.1fr_90px_90px_1.35fr_160px] gap-4 border-b border-[#EEF3F5] px-5 py-4 text-left transition last:border-b-0 ${
                  !user.isActive
                    ? "bg-[#FFF8F7] shadow-[inset_3px_0_0_0_#C96B63] hover:bg-[#FFF1EF]"
                    : "hover:bg-[#FBFCFD]"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${user.isActive ? "bg-[#EAF7F4] text-[#087A6D]" : "bg-[#F2F4F5] text-[#8294A0]"}`}
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
                <span
                  className={`my-auto w-fit justify-self-start rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] ${update ? "bg-[#EAF7F4] text-[#087A6D]" : "bg-[#F2F5F6] text-[#7E909C]"}`}
                >
                  {update ? "Submitted" : "Pending"}
                </span>
                <span className="my-auto text-xs font-extrabold text-[#0E9384]">
                  {update ? duration(update.totalMinutes) : "—"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-[#637A8A]">
                    {update
                      ? update.tasks.map(task => task.description).join(" · ")
                      : "No update for this date"}
                  </p>
                  {update?.blockers && (
                    <p className="mt-1 truncate text-[10px] font-semibold text-[#9C6B45]">
                      Blocker: {update.blockers}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onOpenEmployee(user.id)}
                  className="my-auto inline-flex items-center justify-self-start gap-1 text-xs font-extrabold text-[#087A6D] hover:text-[#065F57]"
                >
                  View history <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {members.map(({ user, update }) => (
            <article
              key={user.id}
              className={`rounded-2xl border p-5 shadow-sm ${
                !user.isActive
                  ? "border-[#F0C9C4] bg-[#FFF8F7]"
                  : "border-[#E1EAED] bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${user.isActive ? "bg-[#EAF7F4] text-[#087A6D]" : "bg-[#F2F4F5] text-[#8294A0]"}`}
                >
                  {initials(user.displayName, user.email)}
                </span>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-extrabold">
                      {user.displayName || user.email}
                    </p>
                    {!user.isActive ? (
                      <span className="inline-flex shrink-0 rounded-full bg-[#FFF1EF] px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#A64D43]">
                        Inactive
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-[10px] font-medium text-[#8797A2]">
                    {user.email}
                  </p>
                </div>
              </div>
              <span
                className={`mt-5 inline-flex rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] ${update ? "bg-[#EAF7F4] text-[#087A6D]" : "bg-[#F2F5F6] text-[#7E909C]"}`}
              >
                {update ? "Submitted" : "Pending"}
              </span>
              <p className="mt-4 min-h-10 text-xs font-medium leading-5 text-[#718493]">
                {update
                  ? update.tasks.map(task => task.description).join(" · ")
                  : "No update submitted for this date."}
              </p>
              {update && (
                <p className="mt-3 text-xs font-extrabold text-[#0E9384]">
                  {duration(update.totalMinutes)}
                </p>
              )}
              <button
                onClick={() => onOpenEmployee(user.id)}
                className="mt-5 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#087A6D] hover:text-[#065F57]"
              >
                View full history <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

export function AccessControlPanel({
  users,
  selfId,
  initialAdminEmail,
  isBusy,
  onChangeRole,
  onChangeActivity,
  onDelete,
}: {
  users: User[];
  selfId: string;
  initialAdminEmail: string;
  isBusy: boolean;
  onChangeRole: (id: string, role: Role) => void;
  onChangeActivity: (id: string, isActive: boolean) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [target, setTarget] = useState<User | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isMessageError, setIsMessageError] = useState(false);
  const [isChangingActivity, setIsChangingActivity] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  async function confirmActivityChange() {
    if (!target) return;
    setIsChangingActivity(true);
    setMessage(null);
    setIsMessageError(false);
    try {
      await onChangeActivity(target.id, !target.isActive);
      setMessage(
        `${target.displayName || target.email} was ${target.isActive ? "deactivated" : "reactivated"}. Historical records were retained.`
      );
      setTarget(null);
    } catch (error) {
      setIsMessageError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Employee access could not be updated."
      );
    } finally {
      setIsChangingActivity(false);
    }
  }
  async function confirmDelete() {
    if (
      !deleteTarget ||
      deleteConfirmation.trim().toLocaleUpperCase() !== "DELETE" ||
      !onDelete
    ) {
      return;
    }
    const deletedName = deleteTarget.displayName || deleteTarget.email;
    setIsDeleting(true);
    setMessage(null);
    setIsMessageError(false);
    try {
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteConfirmation("");
      setIsMessageError(false);
      setMessage(`${deletedName} deleted successfully.`);
    } catch (error) {
      setIsMessageError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Employee could not be permanently deleted."
      );
    } finally {
      setIsDeleting(false);
    }
  }
  const panelBusy = isBusy || isChangingActivity || isDeleting;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
      <BusyOverlay
        active={panelBusy}
        label={isDeleting ? "Deleting employee…" : "Updating access…"}
      />
      <div className="border-b border-[#EAF0F2] px-4 py-4 sm:px-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
          Server-authorized access
        </p>
        <h2 className="mt-1 text-lg font-extrabold">
          Manage team roles and access
        </h2>
        <p className="mt-1 text-xs font-medium text-[#718494]">
          Deactivation preserves employee history and immediately blocks DevSync
          access. It does not hard-delete records.
        </p>
        {message && (
          <p
            role="status"
            aria-live="polite"
            className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${
              isMessageError
                ? "bg-[#FFF5F4] text-[#A64D43]"
                : "bg-[#EAF7F4] text-[#087A6D]"
            }`}
          >
            {!isMessageError ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            ) : null}
            <span>{message}</span>
          </p>
        )}
      </div>

      {users.length ? (
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            <div className="grid grid-cols-[minmax(240px,1.4fr)_100px_150px_minmax(220px,1fr)] gap-3 border-b border-[#EAF0F2] bg-[#F8FAFB] px-4 py-3 text-left text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#7890A0] sm:px-5">
              <span>Employee</span>
              <span>Status</span>
              <span>Role</span>
              <span>Actions</span>
            </div>
            {users.map(member => {
              const protectedAccount =
                member.email.toLowerCase() === initialAdminEmail.toLowerCase();
              const cannotChangeActivity =
                isBusy ||
                isChangingActivity ||
                protectedAccount ||
                member.id === selfId;
              const cannotDelete =
                isBusy ||
                isDeleting ||
                protectedAccount ||
                member.id === selfId ||
                member.role === "admin";
              return (
                <div
                  key={member.id}
                  className="grid grid-cols-[minmax(240px,1.4fr)_100px_150px_minmax(220px,1fr)] gap-3 border-b border-[#EEF3F5] px-4 py-4 text-left transition last:border-b-0 hover:bg-[#FBFCFD] sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${member.isActive ? "bg-[#EAF7F4] text-[#087A6D]" : "bg-[#F2F4F5] text-[#8294A0]"}`}
                    >
                      {initials(member.displayName, member.email)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-extrabold">
                        {member.displayName || member.email}
                        {member.id === selfId && " (you)"}
                      </p>
                      <p className="truncate text-[10px] font-medium text-[#8494A0]">
                        {member.email}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`my-auto w-fit rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] ${member.isActive ? "bg-[#EAF7F4] text-[#087A6D]" : "bg-[#FFF1EF] text-[#A64D43]"}`}
                  >
                    {member.isActive ? "Active" : "Inactive"}
                  </span>
                  <div className="my-auto">
                    <ThemedSelect
                      disabled={isBusy || protectedAccount}
                      value={member.role}
                      aria-label="Employee role"
                      className="w-[8.75rem]"
                      options={[...ROLE_OPTIONS]}
                      onChange={role => onChangeRole(member.id, role as Role)}
                    />
                  </div>
                  <div className="my-auto flex flex-wrap items-center gap-2">
                    <button
                      disabled={cannotChangeActivity}
                      onClick={() => setTarget(member)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-extrabold disabled:cursor-not-allowed disabled:opacity-45 ${member.isActive ? "bg-[#FFF1EF] text-[#A64D43] hover:bg-[#FBE2DF]" : "bg-[#EAF7F4] text-[#087A6D] hover:bg-[#D7F0EA]"}`}
                    >
                      {member.isActive ? (
                        <UserRoundX className="h-3.5 w-3.5" />
                      ) : (
                        <UserRoundCheck className="h-3.5 w-3.5" />
                      )}
                      {member.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                    {onDelete && (
                      <button
                        disabled={cannotDelete}
                        onClick={() => {
                          setMessage(null);
                          setDeleteConfirmation("");
                          setDeleteTarget(member);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#F0C5C0] px-2.5 py-1.5 text-[10px] font-extrabold text-[#A64D43] hover:bg-[#FFF5F4] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-6 text-center text-xs font-semibold text-[#8294A0]">
          No employees found.
        </div>
      )}

      {target && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#173247]/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="activity-change-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#A64D43]">
              Admin confirmation
            </p>
            <h3
              id="activity-change-title"
              className="mt-1 text-xl font-extrabold"
            >
              {target.isActive ? "Deactivate" : "Reactivate"}{" "}
              {target.displayName || target.email}?
            </h3>
            <p className="mt-3 text-sm font-medium leading-6 text-[#6A8191]">
              {target.isActive
                ? "They will no longer be able to use DevSync. Their attendance, work updates, tasks, and audit history remain retained."
                : "They will regain access using their existing verified Google identity."}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                disabled={isChangingActivity}
                onClick={() => setTarget(null)}
                className="rounded-xl border border-[#DDE7EB] px-4 py-2.5 text-xs font-extrabold text-[#5F7482]"
              >
                Cancel
              </button>
              <button
                disabled={isChangingActivity}
                onClick={() => void confirmActivityChange()}
                className={`rounded-xl px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-50 ${target.isActive ? "bg-[#A64D43]" : "bg-[#0E9384]"}`}
              >
                {isChangingActivity ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : target.isActive ? (
                  "Deactivate employee"
                ) : (
                  "Reactivate employee"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#173247]/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-employee-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#A64D43]">
              Permanent deletion
            </p>
            <h3
              id="delete-employee-title"
              className="mt-1 text-xl font-extrabold"
            >
              Delete {deleteTarget.displayName || deleteTarget.email}{" "}
              permanently?
            </h3>
            <p className="mt-3 text-sm font-medium leading-6 text-[#6A8191]">
              This cannot be undone. The employee’s DevSync account, attendance,
              work updates, assigned tasks, task remarks, notifications, and
              audit history will be removed. They will also lose access to
              DevSync.
            </p>
            <label
              className="mt-5 block text-xs font-extrabold text-[#294354]"
              htmlFor="delete-confirmation"
            >
              Type DELETE to confirm
            </label>
            <input
              id="delete-confirmation"
              autoFocus
              value={deleteConfirmation}
              onChange={event => setDeleteConfirmation(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#DDE7EB] px-3 py-2.5 text-sm font-extrabold uppercase tracking-[0.12em] outline-none focus:border-[#A64D43]"
              placeholder="DELETE"
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                disabled={isDeleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirmation("");
                }}
                className="rounded-xl border border-[#DDE7EB] px-4 py-2.5 text-xs font-extrabold text-[#5F7482]"
              >
                Cancel
              </button>
              <button
                disabled={
                  isDeleting ||
                  deleteConfirmation.trim().toLocaleUpperCase() !== "DELETE"
                }
                onClick={() => void confirmDelete()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#A64D43] px-4 py-2.5 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
