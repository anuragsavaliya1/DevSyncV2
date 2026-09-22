/** Unit coverage for notification → workspace navigation. */
import { describe, expect, it } from "vitest";
import {
  notificationHref,
  notificationTargetTab,
} from "../lib/notification-nav-rules";

describe("notification navigation", () => {
  it("routes leave notifications to leave", () => {
    expect(notificationTargetTab("leave_requested", "manager")).toBe("leave");
    expect(notificationTargetTab("leave_approved", "developer")).toBe("leave");
    expect(notificationHref("leave_rejected", "developer")).toBe(
      "/dashboard/leave",
    );
  });

  it("routes attendance correction notifications to attendance", () => {
    expect(
      notificationTargetTab("punch_out_correction_requested", "admin"),
    ).toBe("attendance");
    expect(
      notificationTargetTab("punch_in_correction_approved", "developer"),
    ).toBe("attendance");
  });

  it("routes assigned tasks to my updates for developers", () => {
    expect(notificationTargetTab("task_assigned", "developer")).toBe(
      "my-updates",
    );
  });

  it("routes task completed/overdue to team updates for managers", () => {
    expect(notificationTargetTab("task_completed", "manager")).toBe(
      "team-updates",
    );
    expect(notificationTargetTab("task_overdue", "admin")).toBe(
      "team-updates",
    );
  });
});
