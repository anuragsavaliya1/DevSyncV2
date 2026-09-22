/** Route-level coverage for Admin Dashboard API access control. */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAdminDashboard: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/operations", () => ({
  getAdminDashboard: mocks.getAdminDashboard,
}));

import { GET as getDashboard } from "../app/api/admin/dashboard/route";

const developer = {
  id: "507f1f77bcf86cd799439011",
  firebaseUid: "dev-uid",
  email: "dev@example.com",
  displayName: "Dev",
  photoUrl: null,
  role: "developer" as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedInAt: new Date(),
};

const manager = {
  ...developer,
  id: "507f1f77bcf86cd799439012",
  firebaseUid: "mgr-uid",
  email: "mgr@example.com",
  displayName: "Manager",
  role: "manager" as const,
};

const admin = {
  ...developer,
  id: "507f1f77bcf86cd799439013",
  firebaseUid: "admin-uid",
  email: "admin@example.com",
  displayName: "Admin",
  role: "admin" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/dashboard", () => {
  it("rejects unauthenticated callers", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await getDashboard(
      new NextRequest("http://localhost/api/admin/dashboard"),
    );
    expect(response.status).toBe(401);
    expect(mocks.getAdminDashboard).not.toHaveBeenCalled();
  });

  it("rejects Developer access", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);
    const response = await getDashboard(
      new NextRequest("http://localhost/api/admin/dashboard"),
    );
    expect(response.status).toBe(403);
    expect(mocks.getAdminDashboard).not.toHaveBeenCalled();
  });

  it("allows Manager access", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.getAdminDashboard.mockResolvedValue({
      businessDate: "2026-09-15",
      monthKey: "2026-09",
      summary: {
        totalEmployees: 3,
        presentToday: 1,
        onLeaveToday: 1,
        notPunchedIn: 1,
      },
      onLeaveToday: [],
      upcomingLeaves: [],
      pendingLeaveRequests: [],
      calendarLeaves: [],
      calendarHolidays: [],
      overdueTasks: [],
    });
    const response = await getDashboard(
      new NextRequest("http://localhost/api/admin/dashboard"),
    );
    expect(response.status).toBe(200);
    expect(mocks.getAdminDashboard).toHaveBeenCalledWith(manager, {
      monthKey: undefined,
    });
  });

  it("returns the dashboard payload for Admin", async () => {
    mocks.getCurrentUser.mockResolvedValue(admin);
    mocks.getAdminDashboard.mockResolvedValue({
      businessDate: "2026-09-15",
      monthKey: "2026-09",
      summary: {
        totalEmployees: 3,
        presentToday: 1,
        onLeaveToday: 1,
        notPunchedIn: 1,
      },
      onLeaveToday: [],
      upcomingLeaves: [],
      pendingLeaveRequests: [],
      calendarLeaves: [],
      calendarHolidays: [],
      overdueTasks: [],
    });

    const response = await getDashboard(
      new NextRequest("http://localhost/api/admin/dashboard?month=2026-09"),
    );
    expect(response.status).toBe(200);
    expect(mocks.getAdminDashboard).toHaveBeenCalledWith(admin, {
      monthKey: "2026-09",
    });
    const body = await response.json();
    expect(body.summary.totalEmployees).toBe(3);
  });

  it("maps operation errors to API errors", async () => {
    mocks.getCurrentUser.mockResolvedValue(admin);
    mocks.getAdminDashboard.mockRejectedValue(
      new Error("Could not load admin dashboard."),
    );
    const response = await getDashboard(
      new NextRequest("http://localhost/api/admin/dashboard"),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Could not load admin dashboard.",
    });
  });
});
