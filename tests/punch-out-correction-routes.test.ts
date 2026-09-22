/** Route-level coverage for punch-out correction and manual punch-out APIs. */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createPunchOutCorrectionRequest: vi.fn(),
  createAttendanceCorrectionRequest: vi.fn(),
  listMyPunchOutCorrectionRequests: vi.fn(),
  listPendingPunchOutCorrectionRequests: vi.fn(),
  approvePunchOutCorrectionRequest: vi.fn(),
  rejectPunchOutCorrectionRequest: vi.fn(),
  manuallyPunchOutEmployee: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/operations", () => ({
  createPunchOutCorrectionRequest: mocks.createPunchOutCorrectionRequest,
  createAttendanceCorrectionRequest: mocks.createAttendanceCorrectionRequest,
  listMyPunchOutCorrectionRequests: mocks.listMyPunchOutCorrectionRequests,
  listPendingPunchOutCorrectionRequests:
    mocks.listPendingPunchOutCorrectionRequests,
  approvePunchOutCorrectionRequest: mocks.approvePunchOutCorrectionRequest,
  rejectPunchOutCorrectionRequest: mocks.rejectPunchOutCorrectionRequest,
  manuallyPunchOutEmployee: mocks.manuallyPunchOutEmployee,
}));

import {
  GET as listRequests,
  POST as createRequest,
} from "../app/api/attendance/punch-out-requests/route";
import { POST as approveRequest } from "../app/api/attendance/punch-out-requests/[requestId]/approve/route";
import { POST as rejectRequest } from "../app/api/attendance/punch-out-requests/[requestId]/reject/route";
import { POST as manualPunchOut } from "../app/api/attendance/manual-punch-out/route";

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

describe("punch-out correction request routes", () => {
  it("lets an employee create their own correction request", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);
    mocks.createPunchOutCorrectionRequest.mockResolvedValue({
      id: "req1",
      status: "pending",
    });

    const response = await createRequest(
      new NextRequest("http://localhost/api/attendance/punch-out-requests", {
        method: "POST",
        body: JSON.stringify({
          workDate: "2026-09-11",
          requestedPunchOutAt: "2026-09-11T13:00:00.000Z",
          reason: "Forgot to punch out",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createPunchOutCorrectionRequest).toHaveBeenCalledWith(
      developer,
      expect.objectContaining({
        workDate: "2026-09-11",
        reason: "Forgot to punch out",
      }),
    );
  });

  it("lets an employee create a punch-in correction request", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);
    mocks.createAttendanceCorrectionRequest.mockResolvedValue({
      id: "req-in",
      status: "pending",
      correctionType: "punch_in",
    });

    const response = await createRequest(
      new NextRequest("http://localhost/api/attendance/punch-out-requests", {
        method: "POST",
        body: JSON.stringify({
          workDate: "2026-09-10",
          correctionType: "punch_in",
          requestedPunchInAt: "2026-09-10T03:35:00.000Z",
          reason: "Forgot to punch in",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createAttendanceCorrectionRequest).toHaveBeenCalledWith(
      developer,
      expect.objectContaining({
        workDate: "2026-09-10",
        correctionType: "punch_in",
        reason: "Forgot to punch in",
      }),
    );
  });

  it("lets an employee create a punch-in + punch-out correction request", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);
    mocks.createAttendanceCorrectionRequest.mockResolvedValue({
      id: "req-both",
      status: "pending",
      correctionType: "punch_in_and_out",
    });

    const response = await createRequest(
      new NextRequest("http://localhost/api/attendance/punch-out-requests", {
        method: "POST",
        body: JSON.stringify({
          workDate: "2026-09-10",
          correctionType: "punch_in_and_out",
          requestedPunchInAt: "2026-09-10T03:35:00.000Z",
          requestedPunchOutAt: "2026-09-10T12:40:00.000Z",
          reason: "Forgot both punches",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createAttendanceCorrectionRequest).toHaveBeenCalledWith(
      developer,
      expect.objectContaining({
        correctionType: "punch_in_and_out",
      }),
    );
  });

  it("returns own requests for developers and pending for managers", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);
    mocks.listMyPunchOutCorrectionRequests.mockResolvedValue([{ id: "mine" }]);
    const own = await listRequests(
      new NextRequest(
        "http://localhost/api/attendance/punch-out-requests?scope=mine",
      ),
    );
    expect(own.status).toBe(200);
    expect(mocks.listMyPunchOutCorrectionRequests).toHaveBeenCalledWith(
      developer.id,
    );

    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.listPendingPunchOutCorrectionRequests.mockResolvedValue([
      { id: "pending" },
    ]);
    const pending = await listRequests(
      new NextRequest(
        "http://localhost/api/attendance/punch-out-requests?workDate=2026-09-11",
      ),
    );
    expect(pending.status).toBe(200);
    expect(mocks.listPendingPunchOutCorrectionRequests).toHaveBeenCalledWith(
      manager,
      "2026-09-11",
    );
  });

  it("maps developer approval attempts to 403 via operation error", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);
    mocks.approvePunchOutCorrectionRequest.mockRejectedValue(
      new Error("Only a Manager or Admin can review punch-out corrections."),
    );
    const response = await approveRequest(
      new NextRequest(
        "http://localhost/api/attendance/punch-out-requests/req1/approve",
        { method: "POST" },
      ),
      { params: Promise.resolve({ requestId: "req1" }) },
    );
    expect(response.status).toBe(403);
  });

  it("lets Manager and Admin approve", async () => {
    for (const actor of [manager, admin]) {
      mocks.getCurrentUser.mockResolvedValue(actor);
      mocks.approvePunchOutCorrectionRequest.mockResolvedValue({
        request: { id: "req1", status: "approved" },
        attendance: { state: "punched_out" },
      });
      const response = await approveRequest(
        new NextRequest(
          "http://localhost/api/attendance/punch-out-requests/req1/approve",
          { method: "POST" },
        ),
        { params: Promise.resolve({ requestId: "req1" }) },
      );
      expect(response.status).toBe(200);
      expect(mocks.approvePunchOutCorrectionRequest).toHaveBeenCalledWith(
        actor,
        "req1",
      );
    }
  });

  it("lets Manager reject with a review note", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.rejectPunchOutCorrectionRequest.mockResolvedValue({
      id: "req1",
      status: "rejected",
      reviewNote: "Could not verify",
    });
    const response = await rejectRequest(
      new NextRequest(
        "http://localhost/api/attendance/punch-out-requests/req1/reject",
        {
          method: "POST",
          body: JSON.stringify({ reviewNote: "Could not verify" }),
          headers: { "Content-Type": "application/json" },
        },
      ),
      { params: Promise.resolve({ requestId: "req1" }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.rejectPunchOutCorrectionRequest).toHaveBeenCalledWith(
      manager,
      "req1",
      "Could not verify",
    );
  });

  it("returns 409 when attendance was already punched out", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.approvePunchOutCorrectionRequest.mockRejectedValue(
      new Error(
        "Attendance has already been punched out and cannot be overwritten.",
      ),
    );
    const response = await approveRequest(
      new NextRequest(
        "http://localhost/api/attendance/punch-out-requests/req1/approve",
        { method: "POST" },
      ),
      { params: Promise.resolve({ requestId: "req1" }) },
    );
    expect(response.status).toBe(409);
  });
});

describe("manual punch-out route", () => {
  it("blocks developer manual punch-out via operation error", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);
    mocks.manuallyPunchOutEmployee.mockRejectedValue(
      new Error("Only a Manager or Admin can manually punch out an employee."),
    );
    const response = await manualPunchOut(
      new NextRequest("http://localhost/api/attendance/manual-punch-out", {
        method: "POST",
        body: JSON.stringify({
          userId: "507f1f77bcf86cd799439011",
          workDate: "2026-09-11",
          punchOutAt: "2026-09-11T13:00:00.000Z",
          reason: "Forgot",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(response.status).toBe(403);
  });

  it("lets Manager manually punch out", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.manuallyPunchOutEmployee.mockResolvedValue({
      state: "punched_out",
    });
    const response = await manualPunchOut(
      new NextRequest("http://localhost/api/attendance/manual-punch-out", {
        method: "POST",
        body: JSON.stringify({
          userId: "507f1f77bcf86cd799439011",
          workDate: "2026-09-11",
          punchOutAt: "2026-09-11T13:00:00.000Z",
          reason: "Forgot",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.manuallyPunchOutEmployee).toHaveBeenCalled();
  });
});
