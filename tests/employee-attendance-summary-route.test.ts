import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  canViewTeamData: vi.fn(),
  getEmployeeAttendanceSummary: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/operations", () => ({
  canViewTeamData: mocks.canViewTeamData,
  getEmployeeAttendanceSummary: mocks.getEmployeeAttendanceSummary,
}));

import { GET } from "../app/api/team/members/[userId]/attendance/route";

const manager = {
  id: "507f1f77bcf86cd799439011",
  firebaseUid: "manager-firebase-uid",
  email: "manager@example.com",
  displayName: "Manager",
  photoUrl: null,
  role: "manager" as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedInAt: new Date(),
};

describe("GET /api/team/members/[userId]/attendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns employee attendance summary for the requested month range", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.canViewTeamData.mockReturnValue(true);
    mocks.getEmployeeAttendanceSummary.mockResolvedValue({
      employeeId: "employee-id",
      fromMonth: "2026-09",
      toMonth: "2026-09",
      monthLabel: "September 2026",
      workingDays: 20,
      present: 18,
      late: 1,
      early: 0,
      leave: 1,
      absent: 0,
      missingPunch: 0,
      other: 0,
      monthSummaries: [],
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/team/members/employee-id/attendance?fromMonth=2026-09&toMonth=2026-09",
      ),
      { params: Promise.resolve({ userId: "employee-id" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.getEmployeeAttendanceSummary).toHaveBeenCalledWith(
      manager,
      "employee-id",
      { fromMonth: "2026-09", toMonth: "2026-09" },
    );
    const body = await response.json();
    expect(body.summary.present).toBe(18);
  });

  it("rejects developers", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      ...manager,
      role: "developer" as const,
    });
    mocks.canViewTeamData.mockReturnValue(false);

    const response = await GET(
      new NextRequest(
        "http://localhost/api/team/members/employee-id/attendance",
      ),
      { params: Promise.resolve({ userId: "employee-id" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.getEmployeeAttendanceSummary).not.toHaveBeenCalled();
  });
});
