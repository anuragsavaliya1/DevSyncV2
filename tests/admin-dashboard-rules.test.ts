/** Unit coverage for Admin Dashboard leave/attendance aggregation rules. */
import { describe, expect, it } from "vitest";
import {
  filterApprovedLeavesInRange,
  filterOnLeaveToday,
  filterOverdueAssignedTasks,
  filterPendingLeaveRequests,
  filterUpcomingApprovedLeaves,
  leavesCoveringDate,
  summarizeAdminAttendance,
  type AdminDashboardLeaveSource,
  type AdminDashboardOverdueTaskSource,
} from "../lib/admin-dashboard-rules";
import { isLeaveCoveringDate } from "../lib/leave-rules";
import { addDaysToDateKey } from "../lib/attendance-month";
import {
  defaultWorkspaceTab,
  parseWorkspaceSlug,
  resolveWorkspaceLocation,
} from "../constants/routes";
import {
  canViewAdminDashboard,
  requiresAttendanceTracking,
} from "../constants/permissions";
import { isAttendanceTrackedRole } from "../lib/auth/permissions";

const today = "2026-09-15";

function leave(
  partial: Partial<AdminDashboardLeaveSource> &
    Pick<
      AdminDashboardLeaveSource,
      "id" | "userId" | "startDate" | "endDate" | "status"
    >,
): AdminDashboardLeaveSource {
  return {
    leaveType: "casual",
    dayPortion: "full",
    totalDays: 1,
    employeeName: partial.employeeName || "Employee",
    ...partial,
  };
}

describe("admin dashboard permissions and routing", () => {
  it("allows Admin and Manager to view the dashboard", () => {
    expect(canViewAdminDashboard("admin")).toBe(true);
    expect(canViewAdminDashboard("manager")).toBe(true);
    expect(canViewAdminDashboard("developer")).toBe(false);
  });

  it("excludes Admin from attendance tracking", () => {
    expect(requiresAttendanceTracking("admin")).toBe(false);
    expect(requiresAttendanceTracking("manager")).toBe(true);
    expect(requiresAttendanceTracking("developer")).toBe(true);
    expect(isAttendanceTrackedRole("admin")).toBe(false);
    expect(isAttendanceTrackedRole("manager")).toBe(true);
  });

  it("defaults Admin and Manager landing to overview", () => {
    expect(defaultWorkspaceTab("admin")).toBe("overview");
    expect(defaultWorkspaceTab("manager")).toBe("overview");
    expect(defaultWorkspaceTab("developer")).toBe("my-updates");
  });

  it("clamps overview away from Developer and my-updates away from Admin", () => {
    expect(
      resolveWorkspaceLocation(
        { tab: "overview", employeeId: null },
        "developer",
      ),
    ).toEqual({ tab: "my-updates", employeeId: null });
    expect(
      resolveWorkspaceLocation(
        { tab: "my-updates", employeeId: null },
        "admin",
      ),
    ).toEqual({ tab: "overview", employeeId: null });
    expect(
      resolveWorkspaceLocation({ tab: "overview", employeeId: null }, "manager"),
    ).toEqual({ tab: "overview", employeeId: null });
    expect(
      resolveWorkspaceLocation({ tab: "overview", employeeId: null }, "admin"),
    ).toEqual({ tab: "overview", employeeId: null });
  });

  it("parses /dashboard/overview", () => {
    expect(parseWorkspaceSlug(["overview"])).toEqual({
      tab: "overview",
      employeeId: null,
    });
  });
});

describe("admin dashboard leave filters", () => {
  const leaves: AdminDashboardLeaveSource[] = [
    leave({
      id: "1",
      userId: "u1",
      employeeName: "Rahul Patel",
      startDate: "2026-09-15",
      endDate: "2026-09-15",
      status: "approved",
    }),
    leave({
      id: "2",
      userId: "u2",
      employeeName: "Priya Shah",
      startDate: "2026-09-14",
      endDate: "2026-09-16",
      status: "approved",
      leaveType: "sick",
    }),
    leave({
      id: "3",
      userId: "u3",
      employeeName: "Amit Patel",
      startDate: "2026-09-18",
      endDate: "2026-09-19",
      status: "approved",
    }),
    leave({
      id: "4",
      userId: "u4",
      employeeName: "Pending Person",
      startDate: "2026-09-20",
      endDate: "2026-09-21",
      status: "pending",
    }),
    leave({
      id: "5",
      userId: "u5",
      employeeName: "Rejected Person",
      startDate: "2026-09-18",
      endDate: "2026-09-18",
      status: "rejected",
    }),
    leave({
      id: "6",
      userId: "u6",
      employeeName: "Ends Today",
      startDate: "2026-09-10",
      endDate: "2026-09-15",
      status: "approved",
    }),
  ];

  it("shows approved leave covering today under On Leave Today", () => {
    const rows = filterOnLeaveToday(leaves, today);
    expect(rows.map((row) => row.id).sort()).toEqual(["1", "2", "6"]);
  });

  it("includes leave starting today and ending today", () => {
    expect(isLeaveCoveringDate({ startDate: today, endDate: today }, today)).toBe(
      true,
    );
    expect(
      filterOnLeaveToday(
        [
          leave({
            id: "start",
            userId: "a",
            startDate: today,
            endDate: "2026-09-20",
            status: "approved",
          }),
          leave({
            id: "end",
            userId: "b",
            startDate: "2026-09-10",
            endDate: today,
            status: "approved",
          }),
        ],
        today,
      ).map((row) => row.id),
    ).toEqual(["start", "end"]);
  });

  it("shows future approved leave under Upcoming Leaves", () => {
    const rows = filterUpcomingApprovedLeaves(leaves, today, 7);
    expect(rows.map((row) => row.id)).toEqual(["2", "3"]);
  });

  it("does not treat pending or rejected leave as upcoming approved", () => {
    const rows = filterUpcomingApprovedLeaves(leaves, today, 7);
    expect(rows.some((row) => row.status !== "approved")).toBe(false);
    expect(rows.map((row) => row.id)).not.toContain("4");
    expect(rows.map((row) => row.id)).not.toContain("5");
  });

  it("lists pending requests separately", () => {
    expect(filterPendingLeaveRequests(leaves).map((row) => row.id)).toEqual([
      "4",
    ]);
  });

  it("handles zero upcoming and pending", () => {
    expect(filterUpcomingApprovedLeaves([], today)).toEqual([]);
    expect(filterPendingLeaveRequests([])).toEqual([]);
  });

  it("expands multi-day leave across every calendar date", () => {
    const calendar = filterApprovedLeavesInRange(
      leaves,
      "2026-09-01",
      "2026-09-30",
    );
    expect(leavesCoveringDate(calendar, "2026-09-14").map((r) => r.id).sort()).toEqual([
      "2",
      "6",
    ]);
    expect(leavesCoveringDate(calendar, "2026-09-15").map((r) => r.id).sort()).toEqual([
      "1",
      "2",
      "6",
    ]);
    expect(leavesCoveringDate(calendar, "2026-09-16").map((r) => r.id)).toEqual([
      "2",
    ]);
  });

  it("supports multiple employees on leave the same date", () => {
    const onDate = leavesCoveringDate(
      filterApprovedLeavesInRange(leaves, today, today),
      today,
    );
    expect(onDate.length).toBeGreaterThanOrEqual(2);
  });

  it("does not shift date keys when adding days", () => {
    expect(addDaysToDateKey("2026-09-15", 1)).toBe("2026-09-16");
    expect(addDaysToDateKey("2026-09-15", 7)).toBe("2026-09-22");
  });
});

describe("admin dashboard attendance summary", () => {
  it("counts total, present, on leave, and not punched in correctly", () => {
    expect(
      summarizeAdminAttendance({
        activeUserIds: ["a", "b", "c", "d", "e"],
        punchedInUserIds: ["a", "b"],
        onLeaveUserIds: ["c", "d"],
      }),
    ).toEqual({
      totalEmployees: 5,
      presentToday: 2,
      onLeaveToday: 2,
      notPunchedIn: 1,
    });
  });

  it("does not count on-leave employees as not punched in", () => {
    expect(
      summarizeAdminAttendance({
        activeUserIds: ["a", "b"],
        punchedInUserIds: [],
        onLeaveUserIds: ["a"],
      }),
    ).toEqual({
      totalEmployees: 2,
      presentToday: 0,
      onLeaveToday: 1,
      notPunchedIn: 1,
    });
  });

  it("does not count on-leave employees who also punched in as present", () => {
    expect(
      summarizeAdminAttendance({
        activeUserIds: ["a"],
        punchedInUserIds: ["a"],
        onLeaveUserIds: ["a"],
      }),
    ).toEqual({
      totalEmployees: 1,
      presentToday: 0,
      onLeaveToday: 1,
      notPunchedIn: 0,
    });
  });

  it("ignores punched-in users outside the active attendance-tracked set", () => {
    expect(
      summarizeAdminAttendance({
        activeUserIds: ["dev"],
        punchedInUserIds: ["dev", "admin"],
        onLeaveUserIds: ["admin"],
      }),
    ).toEqual({
      totalEmployees: 1,
      presentToday: 1,
      onLeaveToday: 0,
      notPunchedIn: 0,
    });
  });
});

describe("filterOverdueAssignedTasks", () => {
  const now = new Date("2026-09-17T12:00:00+05:30");

  function task(
    partial: Partial<AdminDashboardOverdueTaskSource> &
      Pick<AdminDashboardOverdueTaskSource, "id" | "employeeId" | "description">,
  ): AdminDashboardOverdueTaskSource {
    return {
      employeeName: partial.employeeName || "Employee",
      priority: "medium",
      dueDate: "2026-09-16",
      dueTime: "18:00",
      ...partial,
    };
  }

  it("keeps only pending tasks past due and labels the assignee", () => {
    const rows = filterOverdueAssignedTasks(
      [
        task({
          id: "1",
          employeeId: "u1",
          employeeName: "Asha",
          description: "Ship report",
          dueDate: "2026-09-16",
          dueTime: "10:00",
          priority: "high",
        }),
        task({
          id: "2",
          employeeId: "u2",
          employeeName: "Bikash",
          description: "Still open",
          dueDate: "2026-09-17",
          dueTime: "18:00",
        }),
        task({
          id: "3",
          employeeId: "u3",
          description: "No due date",
          dueDate: null,
        }),
      ],
      now,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "1",
      employeeId: "u1",
      employeeName: "Asha",
      description: "Ship report",
      priority: "high",
      priorityLabel: "High",
      dueDate: "2026-09-16",
    });
    expect(rows[0].dueLabel).toContain("16");
  });

  it("sorts overdue tasks by due date then employee name", () => {
    const rows = filterOverdueAssignedTasks(
      [
        task({
          id: "b",
          employeeId: "u2",
          employeeName: "Zed",
          description: "Later day",
          dueDate: "2026-09-16",
          dueTime: "09:00",
        }),
        task({
          id: "a",
          employeeId: "u1",
          employeeName: "Amy",
          description: "Same day earlier",
          dueDate: "2026-09-15",
          dueTime: "18:00",
        }),
      ],
      now,
    );

    expect(rows.map((row) => row.id)).toEqual(["a", "b"]);
  });
});
