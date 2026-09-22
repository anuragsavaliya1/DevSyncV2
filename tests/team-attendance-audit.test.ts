/** Team attendance returns punch-out audit visibility for Manager/Admin. */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listTeamAttendanceRows: vi.fn(),
  indiaDateKey: vi.fn(() => "2026-09-11"),
}));

vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/operations", () => ({
  listTeamAttendanceRows: mocks.listTeamAttendanceRows,
  indiaDateKey: mocks.indiaDateKey,
}));

import { GET as teamAttendance } from "../app/api/team-attendance/route";

const manager = {
  id: "507f1f77bcf86cd799439012",
  role: "manager" as const,
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("team attendance punch-out audit", () => {
  it("returns punch-out source and resolved actor for Manager viewers", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.listTeamAttendanceRows.mockResolvedValue([
      {
        user: {
          id: "u1",
          email: "rahul@example.com",
          displayName: "Rahul Patel",
          role: "developer",
          isActive: true,
        },
        attendance: {
          id: "a1",
          userId: "u1",
          workDate: "2026-09-11",
          punchInAt: "2026-09-11T03:35:00.000Z",
          punchOutAt: "2026-09-11T13:01:00.000Z",
          punchOutSource: "regularization",
          punchOutRecordedByUserId: "mgr1",
          punchOutRecordedByRole: "manager",
          punchOutAudit: {
            source: "regularization",
            recordedBy: {
              id: "mgr1",
              displayName: "John Doe",
              email: "john@example.com",
              role: "manager",
            },
            recordedAt: "2026-09-11T13:30:00.000Z",
            reason: "Forgot to punch out",
            requestStatus: "approved",
            requestedAt: "2026-09-11T13:20:00.000Z",
          },
        },
        onLeave: false,
      },
      {
        user: {
          id: "u2",
          email: "priya@example.com",
          displayName: "Priya Patel",
          role: "developer",
          isActive: true,
        },
        attendance: {
          id: "a2",
          punchOutAt: "2026-09-11T12:58:00.000Z",
          punchOutSource: "employee",
          punchOutAudit: {
            source: "employee",
            recordedBy: null,
            recordedAt: "2026-09-11T12:58:00.000Z",
            reason: null,
            requestStatus: null,
            requestedAt: null,
          },
        },
        onLeave: false,
      },
    ]);

    const response = await teamAttendance(
      new NextRequest(
        "http://localhost/api/team-attendance?workDate=2026-09-11",
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.listTeamAttendanceRows).toHaveBeenCalledWith(
      "2026-09-11",
      "active",
    );
    const body = await response.json();
    expect(body.rows[0].attendance.punchOutSource).toBe("regularization");
    expect(body.rows[0].attendance.punchOutAudit.recordedBy.displayName).toBe(
      "John Doe",
    );
    expect(body.rows[1].attendance.punchOutSource).toBe("employee");
    expect(body.rows[1].attendance.punchOutAudit.recordedBy).toBeNull();
  });

  it("does not crash when legacy attendance has no punchOutSource", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.listTeamAttendanceRows.mockResolvedValue([
      {
        user: { id: "u3", email: "legacy@example.com", displayName: "Legacy" },
        attendance: {
          id: "a3",
          punchOutAt: "2026-09-11T12:00:00.000Z",
          punchOutAudit: {
            source: "employee",
            recordedBy: null,
            recordedAt: "2026-09-11T12:00:00.000Z",
            reason: null,
            requestStatus: null,
            requestedAt: null,
          },
        },
        onLeave: false,
      },
    ]);
    const response = await teamAttendance(
      new NextRequest(
        "http://localhost/api/team-attendance?activity=inactive",
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.listTeamAttendanceRows).toHaveBeenCalledWith(
      "2026-09-11",
      "inactive",
    );
    const body = await response.json();
    expect(body.rows[0].attendance.punchOutAt).toBeTruthy();
    expect(body.activity).toBe("inactive");
  });
});
