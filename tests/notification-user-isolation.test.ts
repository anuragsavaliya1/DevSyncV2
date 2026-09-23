/**
 * Cross-verify that notification list / mark-read / delete / clear-all
 * are always scoped to the signed-in user's unique recipientUserId.
 */
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  sort: vi.fn(),
  limit: vi.fn(),
  toArray: vi.fn(),
  countDocuments: vi.fn(),
  updateMany: vi.fn(),
  deleteOne: vi.fn(),
  deleteMany: vi.fn(),
  createIndex: vi.fn(),
  getMongoDatabase: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getMongoDatabase: mocks.getMongoDatabase,
}));

import {
  clearAllNotifications,
  deleteNotification,
  listNotifications,
  markNotificationsRead,
} from "@/lib/operations";

const developerId = new ObjectId();
const managerId = new ObjectId();
const adminId = new ObjectId();
const otherNotificationId = new ObjectId();

function chainFind() {
  mocks.find.mockReturnValue({ sort: mocks.sort });
  mocks.sort.mockReturnValue({ limit: mocks.limit });
  mocks.limit.mockReturnValue({ toArray: mocks.toArray });
}

beforeEach(() => {
  vi.clearAllMocks();
  chainFind();
  mocks.toArray.mockResolvedValue([]);
  mocks.countDocuments.mockResolvedValue(0);
  mocks.updateMany.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });
  mocks.deleteOne.mockResolvedValue({ deletedCount: 0 });
  mocks.deleteMany.mockResolvedValue({ deletedCount: 0 });
  mocks.createIndex.mockResolvedValue("ok");
  mocks.getMongoDatabase.mockResolvedValue({
    collection: () => ({
      find: mocks.find,
      countDocuments: mocks.countDocuments,
      updateMany: mocks.updateMany,
      deleteOne: mocks.deleteOne,
      deleteMany: mocks.deleteMany,
      createIndex: mocks.createIndex,
    }),
  });
});

describe("notification user isolation", () => {
  it.each([
    ["developer", developerId],
    ["manager", managerId],
    ["admin", adminId],
  ] as const)(
    "lists and counts unread only for %s recipientUserId",
    async (_role, userObjectId) => {
      const userId = userObjectId.toHexString();
      await listNotifications(userId, { limit: 10 });

      expect(mocks.find).toHaveBeenCalledWith({
        recipientUserId: userObjectId,
      });
      expect(mocks.countDocuments).toHaveBeenCalledWith({
        recipientUserId: userObjectId,
        isRead: false,
      });
    },
  );

  it("mark-read for one notification still requires the caller's recipientUserId", async () => {
    const userId = developerId.toHexString();
    const notificationId = otherNotificationId.toHexString();
    await markNotificationsRead(userId, notificationId);

    expect(mocks.updateMany).toHaveBeenCalledWith(
      {
        recipientUserId: developerId,
        isRead: false,
        _id: otherNotificationId,
      },
      expect.objectContaining({
        $set: expect.objectContaining({ isRead: true }),
      }),
    );
  });

  it("mark-all-read only updates the caller's unread notifications", async () => {
    await markNotificationsRead(managerId.toHexString());

    expect(mocks.updateMany).toHaveBeenCalledWith(
      {
        recipientUserId: managerId,
        isRead: false,
      },
      expect.objectContaining({
        $set: expect.objectContaining({ isRead: true }),
      }),
    );
  });

  it("delete requires both notification id and caller's recipientUserId", async () => {
    mocks.deleteOne.mockResolvedValue({ deletedCount: 1 });
    const notificationId = otherNotificationId.toHexString();
    await deleteNotification(adminId.toHexString(), notificationId);

    expect(mocks.deleteOne).toHaveBeenCalledWith({
      _id: otherNotificationId,
      recipientUserId: adminId,
    });
  });

  it("does not delete another user's notification (0 matches → not found)", async () => {
    mocks.deleteOne.mockResolvedValue({ deletedCount: 0 });
    await expect(
      deleteNotification(developerId.toHexString(), otherNotificationId.toHexString()),
    ).rejects.toThrow(/not found/i);

    expect(mocks.deleteOne).toHaveBeenCalledWith({
      _id: otherNotificationId,
      recipientUserId: developerId,
    });
  });

  it("clear-all only deletes the caller's notifications", async () => {
    mocks.deleteMany.mockResolvedValue({ deletedCount: 3 });
    const result = await clearAllNotifications(managerId.toHexString());

    expect(mocks.deleteMany).toHaveBeenCalledWith({
      recipientUserId: managerId,
    });
    expect(result).toEqual({ deletedCount: 3 });
  });

  it("developer clear-all cannot wipe manager notifications (separate filter)", async () => {
    await clearAllNotifications(developerId.toHexString());
    await clearAllNotifications(managerId.toHexString());

    expect(mocks.deleteMany).toHaveBeenNthCalledWith(1, {
      recipientUserId: developerId,
    });
    expect(mocks.deleteMany).toHaveBeenNthCalledWith(2, {
      recipientUserId: managerId,
    });
  });
});
