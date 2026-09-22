import { describe, expect, it } from "vitest";
import {
  buildPushNotificationPayload,
  shouldPushNotificationType,
} from "../lib/push/notification-push-rules";

describe("browser push notification rules", () => {
  it("uses the same event allowlist as email", () => {
    expect(shouldPushNotificationType("task_assigned")).toBe(true);
    expect(shouldPushNotificationType("task_overdue")).toBe(true);
    expect(shouldPushNotificationType("leave_approved")).toBe(true);
    expect(shouldPushNotificationType("leave_rejected")).toBe(true);
    expect(shouldPushNotificationType("punch_out_correction_requested")).toBe(
      true,
    );
    expect(shouldPushNotificationType("work_update_reminder")).toBe(false);
  });

  it("builds a compact push payload with dashboard link", () => {
    const payload = buildPushNotificationPayload({
      title: "Leave Approved",
      body: "Your leave request for 2026-09-21 has been approved.\nReason: OK",
      type: "leave_approved",
      appUrl: "https://app.example.com/",
    });
    expect(payload.title).toBe("Leave Approved");
    expect(payload.body).toContain("approved");
    expect(payload.body).not.toContain("Reason:");
    expect(payload.data.url).toBe("https://app.example.com/dashboard/leave");
    expect(payload.data.type).toBe("leave_approved");
    expect(payload.tag).toContain("leave_approved");
    expect(payload.data.tag).toBe(payload.tag);
  });
});
