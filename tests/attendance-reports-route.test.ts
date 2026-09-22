import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getMonthlyAttendanceReport: vi.fn(),
  createAttendanceReportManualEntry: vi.fn(),
  updateAttendanceReportEntry: vi.fn(),
  deleteAttendanceReportEntry: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/operations", () => ({
  getMonthlyAttendanceReport: mocks.getMonthlyAttendanceReport,
  createAttendanceReportManualEntry: mocks.createAttendanceReportManualEntry,
  updateAttendanceReportEntry: mocks.updateAttendanceReportEntry,
  deleteAttendanceReportEntry: mocks.deleteAttendanceReportEntry,
}));

import {
  DELETE,
  GET,
  PATCH,
  POST,
} from "../app/api/attendance-reports/route";
import {
  canViewAttendanceReports,
} from "../constants/permissions";
import {
  parseWorkspaceSlug,
  resolveWorkspaceLocation,
} from "../constants/routes";

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

const developer = {
  ...manager,
  id: "507f1f77bcf86cd799439012",
  role: "developer" as const,
  email: "dev@example.com",
  displayName: "Developer",
};

describe("attendance reports permissions and routing", () => {
  it("allows Manager and Admin to open Attendance Reports", () => {
    expect(canViewAttendanceReports("manager")).toBe(true);
    expect(canViewAttendanceReports("admin")).toBe(true);
    expect(canViewAttendanceReports("developer")).toBe(false);
  });

  it("parses attendance-reports workspace tab", () => {
    expect(parseWorkspaceSlug(["attendance-reports"])).toEqual({
      tab: "attendance-reports",
      employeeId: null,
    });
  });

  it("blocks developers from attendance-reports tab", () => {
    expect(
      resolveWorkspaceLocation(
        { tab: "attendance-reports", employeeId: null },
        "developer",
      ),
    ).toEqual({ tab: "my-updates", employeeId: null });
  });
});

describe("attendance-reports API guards", () => {
  it("rejects unauthenticated GET", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await GET(
      new NextRequest("http://localhost/api/attendance-reports?month=2026-09"),
    );
    expect(response.status).toBe(401);
    expect(mocks.getMonthlyAttendanceReport).not.toHaveBeenCalled();
  });

  it("rejects developer GET", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);
    const response = await GET(
      new NextRequest("http://localhost/api/attendance-reports?month=2026-09"),
    );
    expect(response.status).toBe(403);
    expect(mocks.getMonthlyAttendanceReport).not.toHaveBeenCalled();
  });

  it("lets Manager generate a monthly report", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.getMonthlyAttendanceReport.mockResolvedValue({
      month: "2026-09",
      fromMonth: "2026-09",
      toMonth: "2026-09",
      entries: [],
      summary: { totalEmployees: 0 },
    });
    const response = await GET(
      new NextRequest("http://localhost/api/attendance-reports?month=2026-09"),
    );
    expect(response.status).toBe(200);
    expect(mocks.getMonthlyAttendanceReport).toHaveBeenCalledWith(manager, {
      month: "2026-09",
      fromMonth: undefined,
      toMonth: undefined,
      employeeId: undefined,
    });
  });

  it("lets Manager generate a ranged employee report", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.getMonthlyAttendanceReport.mockResolvedValue({
      month: "2026-07",
      fromMonth: "2026-07",
      toMonth: "2026-09",
      entries: [],
      summary: { totalEmployees: 1 },
    });
    const response = await GET(
      new NextRequest(
        "http://localhost/api/attendance-reports?fromMonth=2026-07&toMonth=2026-09&employeeId=emp-1",
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.getMonthlyAttendanceReport).toHaveBeenCalledWith(manager, {
      month: undefined,
      fromMonth: "2026-07",
      toMonth: "2026-09",
      employeeId: "emp-1",
    });
  });

  it("lets Manager add a manual entry", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.createAttendanceReportManualEntry.mockResolvedValue({
      month: "2026-09",
      entries: [],
    });
    const response = await POST(
      new NextRequest("http://localhost/api/attendance-reports", {
        method: "POST",
        body: JSON.stringify({
          month: "2026-09",
          date: "2026-09-02",
          employeeId: "507f1f77bcf86cd799439013",
          action: "Other",
          details: "Client visit",
          managerRemark: "Approved verbally",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.createAttendanceReportManualEntry).toHaveBeenCalled();
  });

  it("lets Manager update a remark", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.updateAttendanceReportEntry.mockResolvedValue({ month: "2026-09" });
    const response = await PATCH(
      new NextRequest("http://localhost/api/attendance-reports", {
        method: "PATCH",
        body: JSON.stringify({
          month: "2026-09",
          id: "auto:2026-09-02|emp|Arrived Late",
          managerRemark: "Traffic",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.updateAttendanceReportEntry).toHaveBeenCalled();
  });

  it("lets Manager delete an entry", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.deleteAttendanceReportEntry.mockResolvedValue({ month: "2026-09" });
    const response = await DELETE(
      new NextRequest(
        "http://localhost/api/attendance-reports?month=2026-09&id=man1",
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.deleteAttendanceReportEntry).toHaveBeenCalledWith(manager, {
      month: "2026-09",
      id: "man1",
    });
  });
});
