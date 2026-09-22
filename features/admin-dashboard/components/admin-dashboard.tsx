"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  CalendarOff,
  ClipboardList,
  UserRoundCheck,
  Users,
  UserX,
} from "lucide-react";
import { EmptyState, ErrorState } from "@/components/shared/error-state";
import { BusyOverlay } from "@/components/shared/action-loader";
import { AttendanceSkeleton } from "@/features/workspace/components/loading-skeletons";
import { AdminLeaveCalendar } from "@/features/admin-dashboard/components/leave-calendar";
import { OverdueTasksPanel } from "@/features/admin-dashboard/components/overdue-tasks-panel";
import { useAdminDashboard } from "@/features/admin-dashboard/hooks/use-admin-dashboard";
import { formatDate } from "@/features/workspace/utils/format";
import { toIndiaMonthKey } from "@/lib/attendance-month";
import {
  isHalfDayPortion,
  isHourlyLeavePortion,
} from "@/lib/leave-rules";
import type { AdminDashboardLeaveRow } from "@/types/api.types";

function CountBadge({
  count,
  tone,
  label,
}: {
  count: number;
  tone: "amber" | "rose";
  label: string;
}) {
  const styles =
    tone === "amber"
      ? "border-[#F0D7B0] bg-[#FFF4E5] text-[#A87532]"
      : "border-[#F0C9C4] bg-[#FFF1EF] text-[#A64D43]";

  return (
    <span
      aria-label={label}
      className={`inline-flex min-w-8 shrink-0 items-center justify-center rounded-full border px-2.5 py-1 text-xs font-extrabold tabular-nums ${styles}`}
    >
      {count}
    </span>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E1EAED] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EAF0F2] bg-gradient-to-b from-[#FBFCFD] to-white px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-base font-extrabold tracking-[-0.02em] text-[#173247]">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-xs font-medium leading-5 text-[#718494]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function DashboardStatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: "slate" | "teal" | "amber" | "rose";
  icon: typeof Users;
}) {
  const styles = {
    slate: {
      wrap: "border-[#E5EDF0] bg-[#F7FAFB]",
      label: "text-[#8B9BA6]",
      value: "text-[#294354]",
      icon: "bg-white text-[#486170]",
    },
    teal: {
      wrap: "border-[#D7EEE9] bg-[#F3FBFA]",
      label: "text-[#5FA89E]",
      value: "text-[#0E9384]",
      icon: "bg-white text-[#0E9384]",
    },
    amber: {
      wrap: "border-[#F3E6D4] bg-[#FFF9F1]",
      label: "text-[#B8894A]",
      value: "text-[#A87532]",
      icon: "bg-white text-[#A87532]",
    },
    rose: {
      wrap: "border-[#F0E0DE] bg-[#FFF8F7]",
      label: "text-[#B07A73]",
      value: "text-[#A64D43]",
      icon: "bg-white text-[#A64D43]",
    },
  }[tone];

  return (
    <div
      className={`rounded-2xl border px-4 py-4 shadow-[0_1px_0_rgba(16,42,58,0.03)] ${styles.wrap}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={`text-[10px] font-extrabold uppercase tracking-[0.12em] ${styles.label}`}
        >
          {label}
        </p>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#E5EDF0]/40 ${styles.icon}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p
        className={`mt-3 text-2xl font-extrabold tracking-tight ${styles.value}`}
      >
        {value}
      </p>
    </div>
  );
}

function LeaveTable({
  rows,
  mode,
  todayDate,
  emptyTitle,
  emptyDetail,
  onReview,
}: {
  rows: AdminDashboardLeaveRow[];
  mode: "today" | "upcoming" | "pending";
  todayDate?: string;
  emptyTitle: string;
  emptyDetail: string;
  onReview?: (row: AdminDashboardLeaveRow) => void;
}) {
  if (!rows.length) {
    return (
      <EmptyState icon={CalendarDays} title={emptyTitle} detail={emptyDetail} />
    );
  }

  return (
    <div className="ds-data-table-wrap">
      <table className="ds-data-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Leave type</th>
            {mode === "today" ? (
              <>
                <th>Date</th>
                <th>Duration</th>
              </>
            ) : (
              <>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
              </>
            )}
            <th className="min-w-[10rem]">Reason</th>
            <th>Status</th>
            {mode === "pending" ? <th>Action</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              <td className="font-semibold text-[#173247]">
                {row.employeeName}
              </td>
              <td>{row.leaveTypeLabel}</td>
              {mode === "today" ? (
                <>
                  <td>{formatDate(todayDate || row.startDate)}</td>
                  <td>{row.durationLabel}</td>
                </>
              ) : (
                <>
                  <td>{formatDate(row.startDate)}</td>
                  <td>{formatDate(row.endDate)}</td>
                  <td>
                    {isHourlyLeavePortion(row.dayPortion)
                      ? row.durationLabel
                      : isHalfDayPortion(row.dayPortion) ||
                          row.totalDays === 0.5
                        ? "0.5"
                        : row.totalDays}
                  </td>
                </>
              )}
              <td className="max-w-[16rem] font-medium text-[#617687]">
                <span className="line-clamp-2" title={row.reason || undefined}>
                  {row.reason || "—"}
                </span>
              </td>
              <td>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    row.status === "approved"
                      ? "bg-[#EAF7F4] text-[#0E9384]"
                      : row.status === "pending"
                        ? "bg-[#FFF9F1] text-[#A87532]"
                        : "bg-[#F3F5F7] text-[#8B9BA6]"
                  }`}
                >
                  {row.status === "approved"
                    ? mode === "today"
                      ? "On Leave"
                      : "Approved"
                    : row.status === "pending"
                      ? "Pending"
                      : "Rejected"}
                </span>
              </td>
              {mode === "pending" ? (
                <td>
                  <button
                    type="button"
                    onClick={() => onReview?.(row)}
                    className="rounded-lg border border-[#D7EEE9] bg-[#F3FBFA] px-2.5 py-1.5 text-[10px] font-extrabold text-[#0E9384] hover:bg-[#EAF7F4]"
                  >
                    Review
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminDashboardModule({
  businessDate,
  onOpenLeaveManagement,
  onOpenAttendanceReports,
  onOpenEmployee,
}: {
  businessDate: string;
  onOpenLeaveManagement: () => void;
  onOpenAttendanceReports?: () => void;
  onOpenEmployee?: (employeeId: string) => void;
}) {
  const [monthKey, setMonthKey] = useState(() => toIndiaMonthKey());
  const query = useAdminDashboard(monthKey, true);

  if (query.isLoading && !query.data) return <AttendanceSkeleton />;
  if (query.isError && !query.data) {
    return (
      <ErrorState
        message={
          query.error instanceof Error
            ? query.error.message
            : "Could not load admin dashboard."
        }
      />
    );
  }
  if (!query.data) return <AttendanceSkeleton />;

  const data = query.data;
  const viewLeaveAction = (
    <button
      type="button"
      onClick={onOpenLeaveManagement}
      className="inline-flex items-center gap-2 rounded-xl bg-[#0E9384] px-3.5 py-2.5 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(14,147,132,0.22)] transition hover:bg-[#0a7d71]"
    >
      <CalendarDays className="h-3.5 w-3.5" />
      Leave Management
      <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <div className="relative space-y-4">
      <BusyOverlay
        active={query.isFetching && Boolean(query.data)}
        label="Updating dashboard…"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#0E9384]">
            Dashboard
          </p>
          <h2 className="mt-1 text-lg font-extrabold text-[#294354]">
            Today&apos;s overview
          </h2>
          <p className="mt-0.5 text-xs font-medium text-[#8B9BA6]">
            {formatDate(data.businessDate || businessDate)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenAttendanceReports ? (
            <button
              type="button"
              onClick={onOpenAttendanceReports}
              className="inline-flex items-center gap-2 rounded-xl border border-[#D7EEE9] bg-[#F3FBFA] px-3.5 py-2.5 text-xs font-extrabold text-[#0E9384] transition hover:bg-[#EAF7F4]"
            >
              Attendance Reports
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {viewLeaveAction}
        </div>
      </div>

      <SectionCard
        title="Attendance summary"
        subtitle="Active employees for today"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <DashboardStatCard
            label="Total employees"
            value={String(data.summary.totalEmployees)}
            tone="slate"
            icon={Users}
          />
          <DashboardStatCard
            label="Present"
            value={String(data.summary.presentToday)}
            tone="teal"
            icon={UserRoundCheck}
          />
          <DashboardStatCard
            label="On leave"
            value={String(data.summary.onLeaveToday)}
            tone="amber"
            icon={CalendarOff}
          />
          <DashboardStatCard
            label="Not punched in"
            value={String(data.summary.notPunchedIn)}
            tone="rose"
            icon={UserX}
          />
        </div>
        <p className="mt-3 flex items-center gap-2 text-[11px] font-medium text-[#8B9BA6]">
          <ClipboardList className="h-3.5 w-3.5" />
          Approved leave today overrides Not Punched In for those employees.
        </p>
      </SectionCard>

      <OverdueTasksPanel
        rows={data.overdueTasks ?? []}
        onOpenEmployee={onOpenEmployee}
      />

      <SectionCard
        title="On leave today"
        subtitle="Approved leave covering today"
        action={
          <CountBadge
            count={data.onLeaveToday.length}
            tone="amber"
            label={`${data.onLeaveToday.length} on leave today`}
          />
        }
      >
        <LeaveTable
          rows={data.onLeaveToday}
          mode="today"
          todayDate={data.businessDate}
          emptyTitle="No employees are on leave today."
          emptyDetail="Approved leave covering today will appear here."
        />
      </SectionCard>

      <SectionCard
        title="Pending leave requests"
        subtitle="Requests that need Admin review"
        action={
          <CountBadge
            count={data.pendingLeaveRequests.length}
            tone="rose"
            label={`${data.pendingLeaveRequests.length} pending leave requests`}
          />
        }
      >
        <LeaveTable
          rows={data.pendingLeaveRequests}
          mode="pending"
          emptyTitle="No pending leave requests."
          emptyDetail="New leave applications awaiting review will appear here."
          onReview={onOpenLeaveManagement}
        />
      </SectionCard>

      <SectionCard
        title="Upcoming leaves"
        subtitle="Approved leaves in the next 7 days"
        action={
          <button
            type="button"
            onClick={onOpenLeaveManagement}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#D7EEE9] bg-[#F3FBFA] px-3 py-2 text-[11px] font-extrabold text-[#0E9384] transition hover:bg-[#EAF7F4]"
          >
            View all leaves
            <ArrowRight className="h-3 w-3" />
          </button>
        }
      >
        <LeaveTable
          rows={data.upcomingLeaves}
          mode="upcoming"
          emptyTitle="No upcoming approved leaves."
          emptyDetail="Approved leave overlapping the next 7 days will appear here."
        />
      </SectionCard>

      <AdminLeaveCalendar
        monthKey={monthKey}
        todayDate={data.businessDate}
        leaves={data.calendarLeaves}
        holidays={data.calendarHolidays ?? []}
        onMonthChange={setMonthKey}
      />
    </div>
  );
}
