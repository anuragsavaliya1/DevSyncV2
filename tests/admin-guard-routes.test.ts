import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  completeTask: vi.fn(),
  deleteAssignedTask: vi.fn(),
  changeUserActivity: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/operations", () => ({ completeTask: mocks.completeTask, deleteAssignedTask: mocks.deleteAssignedTask }));
vi.mock("@/lib/users", () => ({ changeUserActivity: mocks.changeUserActivity }));

import { DELETE as archiveTask } from "../app/api/tasks/[taskId]/route";
import { PATCH as changeActivity } from "../app/api/admin/users/[userId]/activity/route";

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

describe("Admin-only mutation guards", () => {
  it("rejects a Manager task archive before task lookup or archival", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    const response = await archiveTask(new NextRequest("http://localhost/api/tasks/not-a-real-task", { method: "DELETE" }), { params: Promise.resolve({ taskId: "not-a-real-task" }) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
    expect(mocks.deleteAssignedTask).not.toHaveBeenCalled();
  });

  it("rejects a Manager activity change before parsing or writing the target account", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    const response = await changeActivity(new NextRequest("http://localhost/api/admin/users/not-a-real-user/activity", { method: "PATCH", body: "not-json", headers: { "Content-Type": "application/json" } }), { params: Promise.resolve({ userId: "not-a-real-user" }) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
    expect(mocks.changeUserActivity).not.toHaveBeenCalled();
  });
});
