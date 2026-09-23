/** Centralized TanStack Query keys for DevSync client server-state. */
export const queryKeys = {
  attendance: {
    all: ["attendance"] as const,
    byDate: (workDate: string) => ["attendance", "by-date", workDate] as const,
    team: (
      workDate: string,
      activity: string = "active",
      page?: { start: number; limit: number } | null,
    ) => ["attendance", "team", workDate, activity, page ?? "all"] as const,
    month: (month: string) => ["attendance", "month", month] as const,
    correctionRequests: ["attendance", "correction-requests"] as const,
    myCorrectionRequests: [
      "attendance",
      "correction-requests",
      "mine",
    ] as const,
    pendingCorrectionRequests: (
      workDate?: string,
      page?: { start: number; limit: number } | null,
    ) =>
      [
        "attendance",
        "correction-requests",
        "pending",
        workDate ?? "all",
        page ?? "all",
      ] as const,
  },
  leave: {
    all: ["leave"] as const,
    mine: (page?: { start: number; limit: number } | null) =>
      ["leave", "mine", page ?? "all"] as const,
    summary: ["leave", "summary"] as const,
    list: (filters?: {
      status?: string;
      employeeId?: string;
      start?: number;
      limit?: number;
    }) => ["leave", "list", filters ?? {}] as const,
    detail: (id: string) => ["leave", "detail", id] as const,
  },
  holidays: {
    all: ["holidays"] as const,
    list: (filters?: {
      range?: string;
      asOf?: string;
      start?: number;
      limit?: number;
    }) => ["holidays", "list", filters ?? {}] as const,
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
      action?: string | null;
      start?: number;
      limit?: number;
    }) =>
      [
        "attendance-reports",
        "query",
        filters.fromMonth,
        filters.toMonth,
        filters.employeeId ?? "all",
        filters.action ?? "all",
        filters.start ?? "all",
        filters.limit ?? "all",
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
      start?: number;
      limit?: number;
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
      start?: number;
      limit?: number;
    }) => ["tasks", "list", filters ?? {}] as const,
  },
  notifications: {
    /** Prefix for invalidating every notification query. */
    all: ["notifications"] as const,
    /** Per-user list (badge / header poll). */
    list: (userId: string) => ["notifications", "list", userId] as const,
    /** Per-user infinite drawer feed. */
    infinite: (userId: string) =>
      ["notifications", "infinite", userId] as const,
  },
  team: {
    all: ["team"] as const,
    updates: (
      workDate: string,
      activity: string = "active",
      page?: { start: number; limit: number } | null,
    ) => ["team", "updates", workDate, activity, page ?? "all"] as const,
    member: (userId: string, filters?: unknown) =>
      ["team", "member", userId, filters ?? {}] as const,
  },
  users: {
    all: ["users"] as const,
    list: (page?: { start: number; limit: number } | null) =>
      ["users", "list", page ?? "all"] as const,
  },
  workspace: {
    core: (businessDate: string) =>
      ["workspace", "core", businessDate] as const,
  },
};
