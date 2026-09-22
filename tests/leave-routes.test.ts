/** Route-level coverage for leave request APIs. */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createLeaveRequest: vi.fn(),
  listMyLeaveRequests: vi.fn(),
  listLeaveRequestsForReviewers: vi.fn(),
  getLeaveStatusSummaryForReviewers: vi.fn(),
  getLeaveRequest: vi.fn(),
  approveLeaveRequest: vi.fn(),
  rejectLeaveRequest: vi.fn(),
  deleteLeaveRequest: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/operations", () => ({
  createLeaveRequest: mocks.createLeaveRequest,
  listMyLeaveRequests: mocks.listMyLeaveRequests,
  listLeaveRequestsForReviewers: mocks.listLeaveRequestsForReviewers,
  getLeaveStatusSummaryForReviewers: mocks.getLeaveStatusSummaryForReviewers,
  getLeaveRequest: mocks.getLeaveRequest,
  approveLeaveRequest: mocks.approveLeaveRequest,
  rejectLeaveRequest: mocks.rejectLeaveRequest,
  deleteLeaveRequest: mocks.deleteLeaveRequest,
}));

import {
  GET as listLeave,
  POST as createLeave,
} from "../app/api/leave/route";
import {
  GET as getLeave,
  DELETE as deleteLeave,
} from "../app/api/leave/[requestId]/route";
import { POST as approveLeave } from "../app/api/leave/[requestId]/approve/route";
import { POST as rejectLeave } from "../app/api/leave/[requestId]/reject/route";
import { GET as leaveSummary } from "../app/api/leave/summary/route";

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

describe("leave routes", () => {
  it("lets a developer create a pending leave request", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);
    mocks.createLeaveRequest.mockResolvedValue({
      id: "leave1",
      status: "pending",
    });

    const response = await createLeave(
      new NextRequest("http://localhost/api/leave", {
        method: "POST",
        body: JSON.stringify({
          leaveType: "casual",
          dayPortion: "full",
          startDate: "2026-09-20",
          endDate: "2026-09-22",
          reason: "Family function",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createLeaveRequest).toHaveBeenCalledWith(
      developer,
      expect.objectContaining({
        leaveType: "casual",
        dayPortion: "full",
        startDate: "2026-09-20",
        endDate: "2026-09-22",
        reason: "Family function",
      }),
    );
  });

  it("lets a manager apply approved leave for an employee", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.createLeaveRequest.mockResolvedValue({
      id: "leave2",
      status: "approved",
    });

    const response = await createLeave(
      new NextRequest("http://localhost/api/leave", {
        method: "POST",
        body: JSON.stringify({
          leaveType: "sick",
          dayPortion: "half",
          startDate: "2026-09-16",
          endDate: "2026-09-16",
          reason: "Doctor visit",
          managerRemark: "Covered by team lead",
          userId: developer.id,
          status: "approved",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createLeaveRequest).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        forUserId: developer.id,
        initialStatus: "approved",
        dayPortion: "half",
        managerRemark: "Covered by team lead",
      }),
    );
  });

  it("accepts first_half and second_half day portions", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);
    mocks.createLeaveRequest.mockResolvedValue({
      id: "leave3",
      status: "pending",
    });

    const response = await createLeave(
      new NextRequest("http://localhost/api/leave", {
        method: "POST",
        body: JSON.stringify({
          leaveType: "casual",
          dayPortion: "second_half",
          startDate: "2026-09-18",
          endDate: "2026-09-18",
          reason: "Personal work",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createLeaveRequest).toHaveBeenCalledWith(
      developer,
      expect.objectContaining({
        dayPortion: "second_half",
      }),
    );
  });

  it("accepts hourly other-duration leave portions", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);
    mocks.createLeaveRequest.mockResolvedValue({
      id: "leave4",
      status: "pending",
    });

    const response = await createLeave(
      new NextRequest("http://localhost/api/leave", {
        method: "POST",
        body: JSON.stringify({
          leaveType: "casual",
          dayPortion: "hours_2",
          startDate: "2026-09-18",
          endDate: "2026-09-18",
          reason: "Doctor visit",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createLeaveRequest).toHaveBeenCalledWith(
      developer,
      expect.objectContaining({
        dayPortion: "hours_2",
      }),
    );
  });

  it("blocks developer from applying leave for another user", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);

    const response = await createLeave(
      new NextRequest("http://localhost/api/leave", {
        method: "POST",
        body: JSON.stringify({
          leaveType: "casual",
          startDate: "2026-09-20",
          endDate: "2026-09-20",
          reason: "Trip",
          userId: manager.id,
          status: "approved",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.createLeaveRequest).not.toHaveBeenCalled();
  });

  it("returns the developer own leave list when scope=mine", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);
    mocks.listMyLeaveRequests.mockResolvedValue([{ id: "leave1" }]);

    const response = await listLeave(
      new NextRequest("http://localhost/api/leave?scope=mine"),
    );
    expect(response.status).toBe(200);
    expect(mocks.listMyLeaveRequests).toHaveBeenCalledWith(developer.id);
  });

  it("forbids developer approve via operations error mapping", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);
    mocks.approveLeaveRequest.mockRejectedValue(
      new Error("Only a Manager or Admin can approve leave requests."),
    );

    const response = await approveLeave(
      new NextRequest("http://localhost/api/leave/leave1/approve", {
        method: "POST",
      }),
      { params: Promise.resolve({ requestId: "leave1" }) },
    );
    expect(response.status).toBe(403);
  });

  it("forbids developer reject via operations error mapping", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);
    mocks.rejectLeaveRequest.mockRejectedValue(
      new Error("Only a Manager or Admin can reject leave requests."),
    );

    const response = await rejectLeave(
      new NextRequest("http://localhost/api/leave/leave1/reject", {
        method: "POST",
        body: JSON.stringify({ rejectionReason: "Busy week" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ requestId: "leave1" }) },
    );
    expect(response.status).toBe(403);
  });

  it("lets a manager approve pending leave", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.approveLeaveRequest.mockResolvedValue({
      id: "leave1",
      status: "approved",
    });

    const response = await approveLeave(
      new NextRequest("http://localhost/api/leave/leave1/approve", {
        method: "POST",
      }),
      { params: Promise.resolve({ requestId: "leave1" }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.approveLeaveRequest).toHaveBeenCalledWith(manager, "leave1");
  });

  it("lets an admin approve pending leave", async () => {
    mocks.getCurrentUser.mockResolvedValue(admin);
    mocks.approveLeaveRequest.mockResolvedValue({
      id: "leave1",
      status: "approved",
    });

    const response = await approveLeave(
      new NextRequest("http://localhost/api/leave/leave1/approve", {
        method: "POST",
      }),
      { params: Promise.resolve({ requestId: "leave1" }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.approveLeaveRequest).toHaveBeenCalledWith(admin, "leave1");
  });

  it("lets a manager reject pending leave with a reason", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.rejectLeaveRequest.mockResolvedValue({
      id: "leave1",
      status: "rejected",
      rejectionReason: "Deadline",
    });

    const response = await rejectLeave(
      new NextRequest("http://localhost/api/leave/leave1/reject", {
        method: "POST",
        body: JSON.stringify({ rejectionReason: "Deadline" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ requestId: "leave1" }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.rejectLeaveRequest).toHaveBeenCalledWith(
      manager,
      "leave1",
      "Deadline",
    );
  });

  it("lets an admin reject approved leave with a reason", async () => {
    mocks.getCurrentUser.mockResolvedValue(admin);
    mocks.rejectLeaveRequest.mockResolvedValue({
      id: "leave1",
      status: "rejected",
    });

    const response = await rejectLeave(
      new NextRequest("http://localhost/api/leave/leave1/reject", {
        method: "POST",
        body: JSON.stringify({ rejectionReason: "Coverage gap" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ requestId: "leave1" }) },
    );
    expect(response.status).toBe(200);
  });

  it("rejects without a reason", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);

    const response = await rejectLeave(
      new NextRequest("http://localhost/api/leave/leave1/reject", {
        method: "POST",
        body: JSON.stringify({ rejectionReason: "" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ requestId: "leave1" }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.rejectLeaveRequest).not.toHaveBeenCalled();
  });

  it("blocks reading another employee's leave as developer", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);
    mocks.getLeaveRequest.mockRejectedValue(new Error("Forbidden"));

    const response = await getLeave(
      new NextRequest("http://localhost/api/leave/leave-other"),
      { params: Promise.resolve({ requestId: "leave-other" }) },
    );
    expect(response.status).toBe(403);
  });

  it("lets manager delete leave", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.deleteLeaveRequest.mockResolvedValue({
      deleted: true,
      id: "leave1",
    });

    const response = await deleteLeave(
      new NextRequest("http://localhost/api/leave/leave1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ requestId: "leave1" }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.deleteLeaveRequest).toHaveBeenCalledWith(manager, "leave1");
  });

  it("maps already-reviewed leave to conflict", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.approveLeaveRequest.mockRejectedValue(
      new Error("This leave request has already been reviewed."),
    );

    const response = await approveLeave(
      new NextRequest("http://localhost/api/leave/leave1/approve", {
        method: "POST",
      }),
      { params: Promise.resolve({ requestId: "leave1" }) },
    );
    expect(response.status).toBe(409);
  });

  it("maps overlapping leave to conflict", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);
    mocks.createLeaveRequest.mockRejectedValue(
      new Error(
        "This leave overlaps an existing pending or approved leave request.",
      ),
    );

    const response = await createLeave(
      new NextRequest("http://localhost/api/leave", {
        method: "POST",
        body: JSON.stringify({
          leaveType: "sick",
          startDate: "2026-09-16",
          endDate: "2026-09-18",
          reason: "Fever",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(response.status).toBe(409);
  });

  it("lists pending leave for reviewers", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.listLeaveRequestsForReviewers.mockResolvedValue([
      { id: "leave1", status: "pending" },
    ]);

    const response = await listLeave(
      new NextRequest("http://localhost/api/leave?status=pending"),
    );
    expect(response.status).toBe(200);
    expect(mocks.listLeaveRequestsForReviewers).toHaveBeenCalledWith(
      manager,
      "pending",
    );
  });

  it("returns leave status summary for managers", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.getLeaveStatusSummaryForReviewers.mockResolvedValue({
      pending: 3,
      approved: 5,
      rejected: 1,
      total: 9,
    });

    const response = await leaveSummary();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      summary: { pending: 3, approved: 5, rejected: 1, total: 9 },
    });
    expect(mocks.getLeaveStatusSummaryForReviewers).toHaveBeenCalledWith(
      manager,
    );
  });

  it("forbids developers from leave status summary", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);

    const response = await leaveSummary();
    expect(response.status).toBe(403);
    expect(mocks.getLeaveStatusSummaryForReviewers).not.toHaveBeenCalled();
  });

  it("requires auth for leave status summary", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await leaveSummary();
    expect(response.status).toBe(401);
  });
});
