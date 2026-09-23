/**
 * Quiet Command Center application shell. Every status shown here is fetched from
 * protected Next.js APIs backed by MongoDB; empty states deliberately contain no demo data.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CalendarCheck2,
  CalendarDays,
  ClipboardList,
  ClipboardPlus,
  Crown,
  LayoutDashboard,
  LoaderCircle,
  PartyPopper,
  RefreshCw,
  UsersRound,
  X,
} from "lucide-react";
import {
  canEditWorkUpdates,
  canManageHolidays,
  canReviewLeave,
  canViewAdminDashboard,
  canViewAttendanceReports,
  canViewMyLeave,
  canViewMyUpdates,
  canViewTeam as canViewTeamRole,
  requiresAttendanceTracking,
  requiresWorkUpdateBeforePunchOut,
} from "@/constants/permissions";
import {
  parseWorkspaceSlug,
  resolveWorkspaceLocation,
  workspacePath,
} from "@/constants/routes";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { AdminDashboardModule } from "@/features/admin-dashboard/components/admin-dashboard";
import { useAdminDashboardPageSync } from "@/features/admin-dashboard/hooks/use-admin-dashboard";
import { AttendanceModule } from "@/features/attendance/components/attendance-module";
import { AttendanceReportsModule } from "@/features/attendance-reports/components/attendance-reports-module";
import { useAttendanceReportsPageSync } from "@/features/attendance-reports/hooks/use-attendance-reports";
import { HolidaysModule } from "@/features/holidays/components/holidays-module";
import {
  HolidayCalendarDialog,
  HolidayCalendarHeaderButton,
} from "@/features/holidays/components/holiday-calendar";
import {
  useHolidays,
  useHolidaysPageSync,
} from "@/features/holidays/hooks/use-holidays";
import { LeaveModule } from "@/features/leave/components/leave-module";
import { useLeavePageSync } from "@/features/leave/hooks/use-leave";
import { usePunch } from "@/features/attendance/hooks/use-attendance";
import { useMarkNotificationsRead } from "@/features/notifications/hooks/use-notifications";
import { useRegisterBrowserPush } from "@/features/notifications/hooks/use-register-browser-push";
import { NotificationDrawer } from "@/features/notifications/components/notification-drawer";
import {
  useAddTaskRemark,
  useCompleteTask,
} from "@/features/tasks/hooks/use-tasks";
import { EmployeeDetailCanvas } from "@/features/team/components/employee-detail-canvas";
import {
  AccessControlPanel,
  TeamStatusCanvas,
} from "@/features/team/components/team-management";
import { useTeamUpdates } from "@/features/team/hooks/use-team";
import {
  useAdminUsers,
  useChangeUserActivity,
  useChangeUserRole,
  useDeleteUser,
} from "@/features/users/hooks/use-users";
import {
  MyUpdatesPanel,
  draftTaskTotalMinutes,
  emptyDraftTask,
  splitMinutesToDraft,
  type DraftTask,
} from "@/features/work-updates/components/my-updates-panel";
import { useSaveWorkUpdate } from "@/features/work-updates/hooks/use-work-updates";
import { AttendancePill } from "@/features/workspace/components/attendance-pill";
import {
  RoleManagementSkeleton,
  TeamStatusSkeleton,
  WorkspaceSkeleton,
} from "@/features/workspace/components/loading-skeletons";
import {
  useInvalidateTaskRelated,
  useRefreshActivePage,
  useWorkspaceCore,
} from "@/features/workspace/hooks/use-workspace-core";
import { formatDate, initials } from "@/features/workspace/utils/format";
import { slugFromPathname } from "@/features/workspace/utils/slug";
import {
  mergeWorkUpdateTasks,
  WORK_UPDATE_REQUIRED_BEFORE_PUNCH_OUT_MESSAGE,
} from "@/lib/operation-rules";
import { getRefreshStatus } from "@/lib/utils/refresh-status";
import type {
  PunchAction,
  Role,
  WorkUpdate,
  WorkspaceUser,
} from "@/types/api.types";
import type { WorkspaceTab } from "@/types/common.types";

type Tab = WorkspaceTab;

export function DevSyncWorkspace({
  user,
  businessDate,
  initialAdminEmail,
  initialTab = "my-updates",
  initialEmployeeId = null,
}: {
  user: WorkspaceUser;
  businessDate: string;
  initialAdminEmail: string;
  initialTab?: Tab;
  initialEmployeeId?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const location = useMemo(() => {
    const parsed = parseWorkspaceSlug(
      slugFromPathname(pathname || workspacePath(initialTab, initialEmployeeId))
    );
    return resolveWorkspaceLocation(parsed, user.role);
  }, [pathname, user.role, initialTab, initialEmployeeId]);
  const activeTab = location.tab;
  const selectedEmployeeId = location.employeeId;

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [myUpdatesBusy, setMyUpdatesBusy] = useState(false);
  const [draftTasks, setDraftTasks] = useState<DraftTask[]>([
    emptyDraftTask("first-task"),
  ]);
  const [blockers, setBlockers] = useState("");
  const [workDate, setWorkDate] = useState(businessDate);
  const [teamActivityFilter, setTeamActivityFilter] = useState<
    "all" | "active" | "inactive"
  >("active");
  const [remarkText, setRemarkText] = useState<Record<string, string>>({});
  const [clientReady, setClientReady] = useState(false);
  const [employeeRefreshKey, setEmployeeRefreshKey] = useState(0);

  useRegisterBrowserPush(true);

  const canViewTeam = canViewTeamRole(user.role);
  const core = useWorkspaceCore(businessDate, user.id);
  const teamQuery = useTeamUpdates(
    workDate,
    canViewTeam && (activeTab === "team-updates" || Boolean(selectedEmployeeId)),
    teamActivityFilter,
  );
  const usersQuery = useAdminUsers(
    user.role === "admin" && activeTab === "roles"
  );
  const leaveSync = useLeavePageSync(activeTab === "leave", {
    canReview: canReviewLeave(user.role),
  });
  const holidaysSync = useHolidaysPageSync(activeTab === "holidays");
  const holidaysQuery = useHolidays(activeTab === "holidays");
  const [holidayCalendarOpen, setHolidayCalendarOpen] = useState(false);
  const overviewSync = useAdminDashboardPageSync(activeTab === "overview");
  const reportsSync = useAttendanceReportsPageSync(
    activeTab === "attendance-reports",
  );
  const invalidateTaskRelated = useInvalidateTaskRelated();
  const refreshActivePage = useRefreshActivePage();
  const punchMutation = usePunch();
  const completeTaskMutation = useCompleteTask();
  const saveWorkUpdateMutation = useSaveWorkUpdate();
  const addRemarkMutation = useAddTaskRemark();
  const changeRoleMutation = useChangeUserRole();
  const changeActivityMutation = useChangeUserActivity();
  const deleteUserMutation = useDeleteUser();
  const markReadMutation = useMarkNotificationsRead();

  const attendance = core.attendance;
  const updates = core.updates;
  const tasks = core.tasks;
  const teamMembers = teamQuery.data ?? [];
  const isLoading = core.isLoading;
  const isTeamLoading = teamQuery.isLoading && teamQuery.data === undefined;
  const isRefreshing =
    (activeTab === "my-updates" && core.isFetching) ||
    (activeTab === "team-updates" && teamQuery.isFetching) ||
    (activeTab === "roles" && usersQuery.isFetching) ||
    (activeTab === "attendance" && core.isFetching) ||
    (activeTab === "leave" && leaveSync.isFetching) ||
    (activeTab === "holidays" && holidaysSync.isFetching) ||
    (activeTab === "overview" && overviewSync.isFetching) ||
    (activeTab === "attendance-reports" && reportsSync.isFetching);
  const pageSyncedAt = selectedEmployeeId
    ? core.lastRefreshedAt
    : activeTab === "team-updates"
      ? teamQuery.dataUpdatedAt
        ? new Date(teamQuery.dataUpdatedAt).toISOString()
        : null
      : activeTab === "roles"
        ? usersQuery.dataUpdatedAt
          ? new Date(usersQuery.dataUpdatedAt).toISOString()
          : null
        : activeTab === "attendance"
          ? core.attendanceUpdatedAt
            ? new Date(core.attendanceUpdatedAt).toISOString()
            : null
          : activeTab === "leave"
            ? leaveSync.dataUpdatedAt
              ? new Date(leaveSync.dataUpdatedAt).toISOString()
              : null
            : activeTab === "holidays"
              ? holidaysSync.dataUpdatedAt
                ? new Date(holidaysSync.dataUpdatedAt).toISOString()
                : null
              : activeTab === "overview"
                ? overviewSync.dataUpdatedAt
                  ? new Date(overviewSync.dataUpdatedAt).toISOString()
                  : null
                : activeTab === "attendance-reports"
                  ? reportsSync.dataUpdatedAt
                    ? new Date(reportsSync.dataUpdatedAt).toISOString()
                    : null
                  : core.myUpdatesUpdatedAt
                    ? new Date(core.myUpdatesUpdatedAt).toISOString()
                    : core.lastRefreshedAt;
  const error =
    actionError ||
    core.error ||
    (teamQuery.error instanceof Error ? teamQuery.error.message : null) ||
    (usersQuery.error instanceof Error ? usersQuery.error.message : null);
  const visibleError = error && error !== dismissedError ? error : null;
  const unreadCount = core.unreadCount;
  const firstName = user.displayName?.split(" ")[0] || user.email.split("@")[0];

  useEffect(() => {
    setClientReady(true);
  }, []);

  const selectedUpdate = useMemo(
    () => updates.find(update => update.updateDate === workDate) || null,
    [updates, workDate]
  );

  function navigateWorkspace(tab: Tab, employeeId: string | null = null) {
    const nextPath = workspacePath(tab, employeeId);
    if (nextPath !== pathname) {
      router.push(nextPath as Parameters<typeof router.push>[0]);
    }
  }

  async function refreshPageData() {
    await refreshActivePage({
      activeTab,
      hasEmployeeDetail: Boolean(selectedEmployeeId),
    });
    if (selectedEmployeeId) {
      setEmployeeRefreshKey(key => key + 1);
    }
  }

  function openTab(id: Tab) {
    navigateWorkspace(id, null);
  }

  function openEmployee(employeeId: string) {
    navigateWorkspace("team-updates", employeeId);
  }

  function closeEmployee() {
    navigateWorkspace("team-updates", null);
  }

  async function perform(action: () => Promise<void>) {
    setIsBusy(true);
    setActionError(null);
    setDismissedError(null);
    try {
      await action();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Action failed."
      );
    } finally {
      setIsBusy(false);
    }
  }

  function punch(action: PunchAction) {
    return perform(async () => {
      if (
        action === "punch_out" &&
        requiresWorkUpdateBeforePunchOut(user.role)
      ) {
        const hasTodaysWorkUpdate = updates.some(
          (update) =>
            update.updateDate === businessDate && update.tasks.length > 0,
        );
        if (!hasTodaysWorkUpdate) {
          throw new Error(WORK_UPDATE_REQUIRED_BEFORE_PUNCH_OUT_MESSAGE);
        }
      }
      await punchMutation.mutateAsync(action);
    });
  }

  function completeAssignedTask(taskId: string) {
    return perform(async () => {
      setMyUpdatesBusy(true);
      try {
        await completeTaskMutation.mutateAsync(taskId);
      } finally {
        setMyUpdatesBusy(false);
      }
    });
  }

  function submitUpdate() {
    return perform(async () => {
      setMyUpdatesBusy(true);
      try {
        const draft = draftTasks.map(task => ({
          id: task.id,
          description: task.description,
          minutes: draftTaskTotalMinutes(task),
        }));
        const existing = updates.find(update => update.updateDate === workDate);
        const existingTasks = existing?.tasks ?? [];
        const existingIds = new Set(existingTasks.map(task => task.id));
        const isEditing = draft.some(task => existingIds.has(task.id));
        const tasks = mergeWorkUpdateTasks({
          existingTasks,
          draftTasks: draft,
        });
        const nextBlockers = isEditing
          ? blockers || null
          : blockers.trim()
            ? blockers
            : (existing?.blockers ?? null);

        await saveWorkUpdateMutation.mutateAsync({
          updateDate: workDate,
          tasks,
          blockers: nextBlockers,
        });
        setDraftTasks([emptyDraftTask()]);
        setBlockers("");
      } finally {
        setMyUpdatesBusy(false);
      }
    });
  }

  function editSubmittedUpdate(update: WorkUpdate) {
    setWorkDate(update.updateDate);
    setDraftTasks(
      update.tasks.length
        ? update.tasks.map(task => ({
            id: task.id,
            description: task.description,
            ...splitMinutesToDraft(task.minutes),
          }))
        : [emptyDraftTask()]
    );
    setBlockers(update.blockers || "");
  }

  function addRemark(taskId: string) {
    return perform(async () => {
      setMyUpdatesBusy(true);
      try {
        await addRemarkMutation.mutateAsync({
          taskId,
          text: remarkText[taskId] || "",
        });
        setRemarkText(current => ({ ...current, [taskId]: "" }));
      } finally {
        setMyUpdatesBusy(false);
      }
    });
  }

  function changeRole(targetUserId: string, role: Role) {
    return perform(async () => {
      await changeRoleMutation.mutateAsync({ userId: targetUserId, role });
    });
  }

  async function changeActivity(targetUserId: string, isActive: boolean) {
    await changeActivityMutation.mutateAsync({
      userId: targetUserId,
      isActive,
    });
  }

  async function deleteEmployee(targetUserId: string) {
    await deleteUserMutation.mutateAsync(targetUserId);
    if (selectedEmployeeId === targetUserId) {
      closeEmployee();
    }
  }

  function markRead(notificationId?: string) {
    return perform(async () => {
      await markReadMutation.mutateAsync(notificationId);
    });
  }

  const tabs: {
    id: Tab;
    label: string;
    icon: typeof ClipboardList;
    visible: boolean;
  }[] = [
    {
      id: "overview",
      label: "Dashboard",
      icon: LayoutDashboard,
      visible: canViewAdminDashboard(user.role),
    },
    {
      id: "my-updates",
      label: "My updates",
      icon: ClipboardList,
      visible: canViewMyUpdates(user.role),
    },
    {
      id: "team-updates",
      label: "Team updates",
      icon: UsersRound,
      visible: canViewTeam,
    },
    {
      id: "attendance",
      label: "Attendance",
      icon: CalendarCheck2,
      visible: true,
    },
    {
      id: "leave",
      label: "Leave",
      icon: CalendarDays,
      visible: true,
    },
    {
      id: "holidays",
      label: "Holidays",
      icon: PartyPopper,
      visible: canManageHolidays(user.role),
    },
    {
      id: "attendance-reports",
      label: "Attendance Reports",
      icon: ClipboardPlus,
      visible: canViewAttendanceReports(user.role),
    },
    {
      id: "roles",
      label: "Role management",
      icon: Crown,
      visible: user.role === "admin",
    },
  ];

  const pageTitle = selectedEmployeeId
    ? "Employee operations"
    : activeTab === "overview"
      ? "Dashboard"
      : activeTab === "my-updates"
        ? `Good day, ${firstName}.`
        : activeTab === "team-updates"
          ? "Daily team status"
          : activeTab === "attendance"
            ? "Attendance ledger"
            : activeTab === "leave"
              ? "Leave management"
              : activeTab === "holidays"
                ? "Holiday management"
                : activeTab === "attendance-reports"
                  ? "Monthly Attendance Report"
                  : "Manage team roles";

  function renderMainContent() {
    if (selectedEmployeeId) {
      return (
        <EmployeeDetailCanvas
          employeeId={selectedEmployeeId}
          viewerRole={user.role}
          refreshKey={employeeRefreshKey}
          onBack={closeEmployee}
          onChanged={() => {
            void invalidateTaskRelated();
          }}
        />
      );
    }
    if (activeTab === "overview") {
      return (
        <AdminDashboardModule
          businessDate={businessDate}
          onOpenLeaveManagement={() => openTab("leave")}
          onOpenAttendanceReports={() => openTab("attendance-reports")}
          onOpenEmployee={openEmployee}
        />
      );
    }
    if (isLoading && updates.length === 0 && tasks.length === 0 && !attendance) {
      return <WorkspaceSkeleton />;
    }
    if (activeTab === "my-updates") {
      return (
        <MyUpdatesPanel
          attendance={attendance}
          businessDate={businessDate}
          workDate={workDate}
          setWorkDate={setWorkDate}
          update={selectedUpdate}
          updates={updates}
          tasks={tasks}
          draftTasks={draftTasks}
          blockers={blockers}
          remarkText={remarkText}
          isSubmittingUpdate={saveWorkUpdateMutation.isPending}
          isTaskBusy={
            myUpdatesBusy ||
            completeTaskMutation.isPending ||
            addRemarkMutation.isPending
          }
          canEditUpdates={canEditWorkUpdates(user.role)}
          onDraftTasks={setDraftTasks}
          onBlockers={setBlockers}
          onRemarkText={setRemarkText}
          onSubmit={submitUpdate}
          onEditUpdate={editSubmittedUpdate}
          onComplete={completeAssignedTask}
          onAddRemark={addRemark}
        />
      );
    }
    if (activeTab === "team-updates") {
      return isTeamLoading ? (
        <TeamStatusSkeleton />
      ) : (
        <TeamStatusCanvas
          businessDate={businessDate}
          workDate={workDate}
          setWorkDate={setWorkDate}
          activityFilter={teamActivityFilter}
          onActivityFilterChange={setTeamActivityFilter}
          members={teamMembers}
          onOpenEmployee={openEmployee}
          onAssigned={() => {
            void invalidateTaskRelated();
          }}
        />
      );
    }
    if (activeTab === "attendance") {
      return (
        <AttendanceModule
          user={user}
          role={user.role}
          attendance={attendance}
          businessDate={businessDate}
          canViewTeam={canViewTeam}
        />
      );
    }
    if (activeTab === "leave") {
      return (
        <LeaveModule
          canReview={canReviewLeave(user.role)}
          showMyLeave={canViewMyLeave(user.role)}
          businessDate={businessDate}
        />
      );
    }
    if (activeTab === "holidays") {
      return <HolidaysModule businessDate={businessDate} />;
    }
    if (activeTab === "attendance-reports") {
      return <AttendanceReportsModule />;
    }
    return (
      <AccessControlPanel
        selfId={user.id}
        initialAdminEmail={initialAdminEmail}
        isBusy={isBusy}
        onChangeRole={changeRole}
        onChangeActivity={changeActivity}
        onDelete={deleteEmployee}
      />
    );
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#eef2f5] text-[#102a3a]">
      <header className="z-30 shrink-0 border-b border-[#e4ecef] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-3 sm:h-16 sm:gap-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#102a3a] font-display text-[12px] font-bold text-[#7ed7cb] sm:h-10 sm:w-10 sm:rounded-2xl sm:text-[13px]">
              D
            </span>
            <div className="min-w-0">
              <p className="font-display text-[16px] font-bold tracking-[-0.04em] sm:text-[18px]">
                devsync
              </p>
              <p className="hidden text-[9px] font-semibold uppercase tracking-[0.18em] text-[#7a8f9d] sm:block">
                Daily operating system
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <button
              type="button"
              aria-label="Open notifications"
              onClick={() => setIsDrawerOpen(open => !open)}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-[#617687] transition hover:bg-[#eef6f5] hover:text-[#0d8f81] sm:h-10 sm:w-10"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 min-w-4 rounded-full bg-[#0d8f81] px-1 text-[9px] font-bold leading-4 text-white sm:right-1.5 sm:top-1.5">
                  {unreadCount}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2 border-l border-[#e7eef1] pl-2 sm:gap-2.5 sm:pl-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eaf7f4] text-[10px] font-bold text-[#0a7267]">
                {initials(user.displayName, user.email)}
              </span>
              <span className="hidden max-w-32 truncate text-[13px] font-semibold sm:inline">
                {user.displayName || user.email}
              </span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1">
        <aside className="hidden w-[232px] shrink-0 flex-col border-r border-[#e4ecef] bg-white p-5 lg:flex">
          <nav className="flex flex-col gap-1.5">
            {tabs
              .filter(tab => tab.visible)
              .map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => openTab(id)}
                  className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold transition ${
                    activeTab === id
                      ? "bg-[#eaf7f4] text-[#0a7267]"
                      : "text-[#617687] hover:bg-[#f4f7f9] hover:text-[#102a3a]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-[#e4ecef] bg-[#f7fafb] p-3.5">
            <div className="flex items-start gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eaf7f4] text-[11px] font-bold text-[#0a7267]">
                {initials(user.displayName, user.email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0d8f81]">
                  Active account
                </p>
                <p
                  className="mt-1 truncate text-[13px] font-semibold leading-snug text-[#102a3a]"
                  title={user.displayName || user.email}
                >
                  {user.displayName || user.email.split("@")[0]}
                </p>
                <p
                  className="mt-0.5 break-all text-[11px] font-medium leading-snug text-[#7a8f9d]"
                  title={user.email}
                >
                  {user.email}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#e4ecef] pt-3">
              <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0d8f81] ring-1 ring-[#d8ebe7]">
                {user.role}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#7a8f9d]">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${clientReady ? "bg-[#0d8f81]" : "bg-[#c5d0d7]"}`}
                />
                {clientReady ? "Live" : "Connecting"}
              </span>
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <nav className="shrink-0 border-b border-[#e4ecef] bg-white px-3 py-2 lg:hidden">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tabs
                .filter(tab => tab.visible)
                .map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => openTab(id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold transition ${
                      activeTab === id
                        ? "bg-[#eaf7f4] text-[#0a7267]"
                        : "bg-[#f4f7f9] text-[#617687]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
            </div>
          </nav>

          <section className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-6 lg:p-7">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-[#E1EAED] bg-white/80 px-4 py-3.5 shadow-sm backdrop-blur-sm sm:mb-5 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0d8f81]">
                  {formatDate(businessDate)}
                </p>
                <h1 className="mt-1 font-display text-[22px] font-bold tracking-[-0.04em] text-[#173247] sm:text-[28px] lg:text-[32px]">
                  {pageTitle}
                </h1>
                <div className="mt-2 inline-flex items-center gap-1.5">
                  <p
                    aria-live="polite"
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7a8f9d]"
                  >
                    {isRefreshing && (
                      <LoaderCircle className="h-3 w-3 animate-spin text-[#0d8f81]" />
                    )}
                    {getRefreshStatus(pageSyncedAt, isRefreshing)}
                  </p>
                  <button
                    type="button"
                    aria-label="Refresh Data"
                    title="Refresh Data"
                    disabled={isRefreshing || isBusy}
                    onClick={() => void refreshPageData()}
                    className="inline-flex cursor-pointer items-center justify-center rounded-md p-1 text-[#7a8f9d] transition hover:bg-[#eef6f5] hover:text-[#0d8f81] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!selectedEmployeeId && activeTab === "holidays" ? (
                  <HolidayCalendarHeaderButton
                    onClick={() => setHolidayCalendarOpen(true)}
                  />
                ) : null}
                {!selectedEmployeeId &&
                  activeTab !== "roles" &&
                  requiresAttendanceTracking(user.role) && (
                    <AttendancePill
                      attendance={attendance}
                      isBusy={punchMutation.isPending}
                      onPunch={punch}
                      punchOutBlockedMessage={
                        requiresWorkUpdateBeforePunchOut(user.role) &&
                        !updates.some(
                          (update) =>
                            update.updateDate === businessDate &&
                            update.tasks.length > 0,
                        )
                          ? WORK_UPDATE_REQUIRED_BEFORE_PUNCH_OUT_MESSAGE
                          : null
                      }
                      onPunchOutBlocked={(message) => {
                        setActionError(message);
                        setDismissedError(null);
                      }}
                    />
                  )}
              </div>
            </div>
            {visibleError && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-xl border border-[#F4C9C4] bg-[#FFF5F4] px-4 py-3 text-xs font-semibold text-[#A64D43]"
              >
                <p className="min-w-0 flex-1">{visibleError}</p>
                <button
                  type="button"
                  aria-label="Dismiss error"
                  onClick={() => {
                    setActionError(null);
                    setDismissedError(visibleError);
                  }}
                  className="shrink-0 rounded-md p-0.5 text-[#A64D43] hover:bg-[#F8E4E1]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {renderMainContent()}
        </section>
        </div>
      </div>

      {isDrawerOpen && (
        <NotificationDrawer
          onClose={() => setIsDrawerOpen(false)}
          onMarkRead={markRead}
          viewerRole={user.role}
          viewerUserId={user.id}
        />
      )}
      {holidayCalendarOpen ? (
        <HolidayCalendarDialog
          businessDate={businessDate}
          holidays={holidaysQuery.data ?? []}
          onClose={() => setHolidayCalendarOpen(false)}
        />
      ) : null}
    </main>
  );
}
