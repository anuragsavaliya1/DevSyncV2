/** Centralized TanStack Query keys for DevSync client server-state. */
export const queryKeys = {
  attendance: {
    all: ["attendance"] as const,
    byDate: (workDate: string) => ["attendance", "by-date", workDate] as const,
    team: (workDate: string, activity: string = "active") =>
      ["attendance", "team", workDate, activity] as const,
    month: (month: string) => ["attendance", "month", month] as const,
    correctionRequests: ["attendance", "correction-requests"] as const,
    myCorrectionRequests: ["attendance", "correction-requests", "mine"] as const,
    pendingCorrectionRequests: (workDate?: string) =>
      ["attendance", "correction-requests", "pending", workDate ?? "all"] as const,
  },
  leave: {
    all: ["leave"] as const,
    mine: ["leave", "mine"] as const,
    summary: ["leave", "summary"] as const,
    list: (filters?: { status?: string }) =>
      ["leave", "list", filters ?? {}] as const,
    detail: (id: string) => ["leave", "detail", id] as const,
  },
  holidays: {
    all: ["holidays"] as const,
    list: ["holidays", "list"] as const,
  },
  adminDashboard: {
    all: ["admin-dashboard"] as const,
    byMonth: (monthKey: string) =>
      ["admin-dashboard", "month", monthKey] as const,
  },
  attendanceReports: {
    all: ["attendance-reports"] as const,
    byMonth: (monthKey: string) =>
      ["attendance-reports", "month", monthKey] as const,
    query: (filters: {
      fromMonth: string;
      toMonth: string;
      employeeId?: string | null;
    }) =>
      [
        "attendance-reports",
        "query",
        filters.fromMonth,
        filters.toMonth,
        filters.employeeId ?? "all",
      ] as const,
  },
  workUpdates: {
    all: ["work-updates"] as const,
    list: (filters?: {
      userId?: string;
      workDate?: string;
      range?: string;
      fromDate?: string;
      toDate?: string;
    }) => ["work-updates", "list", filters ?? {}] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    list: (filters?: {
      developerUserId?: string;
      status?: string;
      range?: string;
      fromDate?: string;
      toDate?: string;
    }) => ["tasks", "list", filters ?? {}] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    infinite: ["notifications", "infinite"] as const,
  },
  team: {
    all: ["team"] as const,
    updates: (workDate: string, activity: string = "active") =>
      ["team", "updates", workDate, activity] as const,
    member: (userId: string, filters?: unknown) =>
      ["team", "member", userId, filters ?? {}] as const,
  },
  users: {
    all: ["users"] as const,
    list: ["users", "list"] as const,
  },
  workspace: {
    core: (businessDate: string) =>
      ["workspace", "core", businessDate] as const,
  },
};
