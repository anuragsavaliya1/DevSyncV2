import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
  deleteNotification: vi.fn(),
  clearAllNotifications: vi.fn(),
  canViewTeamData: vi.fn(),
  maybeNotifyOverdueAssignedTasks: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/operations", () => ({
  listNotifications: mocks.listNotifications,
  markNotificationsRead: mocks.markNotificationsRead,
  deleteNotification: mocks.deleteNotification,
  clearAllNotifications: mocks.clearAllNotifications,
  canViewTeamData: mocks.canViewTeamData,
  maybeNotifyOverdueAssignedTasks: mocks.maybeNotifyOverdueAssignedTasks,
}));

import {
  DELETE,
  GET,
  PATCH,
} from "../app/api/notifications/route";

const user = {
  id: "507f1f77bcf86cd799439011",
  role: "developer" as const,
  email: "dev@example.com",
  displayName: "Dev",
  photoUrl: null,
  firebaseUid: "fb",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedInAt: new Date(),
};

describe("notifications API", () => {
  it("returns a paginated notification page", async () => {
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.canViewTeamData.mockReturnValue(false);
    mocks.listNotifications.mockResolvedValue({
      notifications: [{ id: "n1", title: "Hi", body: "Body", isRead: false }],
      unreadCount: 1,
      hasMore: true,
      nextCursor: "cursor-1",
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/notifications?limit=20&cursor=cursor-0",
      ),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      unreadCount: 1,
      hasMore: true,
      nextCursor: "cursor-1",
    });
    expect(mocks.listNotifications).toHaveBeenCalledWith(user.id, {
      limit: 20,
      cursor: "cursor-0",
    });
    expect(mocks.maybeNotifyOverdueAssignedTasks).not.toHaveBeenCalled();
  });

  it("runs overdue sweep for managers before listing", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...user, role: "manager" });
    mocks.canViewTeamData.mockReturnValue(true);
    mocks.maybeNotifyOverdueAssignedTasks.mockResolvedValue({
      ran: true,
      sent: 1,
    });
    mocks.listNotifications.mockResolvedValue({
      notifications: [],
      unreadCount: 0,
      hasMore: false,
      nextCursor: null,
    });

    const response = await GET(
      new NextRequest("http://localhost/api/notifications"),
    );
    expect(response.status).toBe(200);
    expect(mocks.maybeNotifyOverdueAssignedTasks).toHaveBeenCalled();
  });

  it("deletes a single notification", async () => {
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.deleteNotification.mockResolvedValue({ deleted: true, id: "n1" });
    const response = await DELETE(
      new NextRequest("http://localhost/api/notifications?id=n1"),
    );
    expect(response.status).toBe(200);
    expect(mocks.deleteNotification).toHaveBeenCalledWith(user.id, "n1");
  });

  it("clears all notifications", async () => {
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.clearAllNotifications.mockResolvedValue({ deletedCount: 4 });
    const response = await DELETE(
      new NextRequest("http://localhost/api/notifications?all=true"),
    );
    expect(response.status).toBe(200);
    expect(mocks.clearAllNotifications).toHaveBeenCalledWith(user.id);
  });

  it("scopes list/mark-read/delete/clear to each role's own user id", async () => {
    const roles = [
      { ...user, id: "507f1f77bcf86cd799439011", role: "developer" as const },
      { ...user, id: "507f1f77bcf86cd799439012", role: "manager" as const },
      { ...user, id: "507f1f77bcf86cd799439013", role: "admin" as const },
    ];

    for (const actor of roles) {
      mocks.getCurrentUser.mockResolvedValue(actor);
      mocks.canViewTeamData.mockReturnValue(actor.role !== "developer");
      mocks.listNotifications.mockResolvedValue({
        notifications: [],
        unreadCount: 0,
        hasMore: false,
        nextCursor: null,
      });
      mocks.markNotificationsRead.mockResolvedValue(undefined);
      mocks.deleteNotification.mockResolvedValue({ deleted: true, id: "n1" });
      mocks.clearAllNotifications.mockResolvedValue({ deletedCount: 1 });

      await GET(new NextRequest("http://localhost/api/notifications"));
      expect(mocks.listNotifications).toHaveBeenLastCalledWith(actor.id, {
        limit: expect.any(Number),
        cursor: null,
      });

      await PATCH(
        new NextRequest("http://localhost/api/notifications", {
          method: "PATCH",
          body: JSON.stringify({ notificationId: "n1" }),
          headers: { "Content-Type": "application/json" },
        }),
      );
      expect(mocks.markNotificationsRead).toHaveBeenLastCalledWith(
        actor.id,
        "n1",
      );

      await DELETE(
        new NextRequest("http://localhost/api/notifications?id=n1"),
      );
      expect(mocks.deleteNotification).toHaveBeenLastCalledWith(actor.id, "n1");

      await DELETE(
        new NextRequest("http://localhost/api/notifications?all=true"),
      );
      expect(mocks.clearAllNotifications).toHaveBeenLastCalledWith(actor.id);
    }
  });
});
