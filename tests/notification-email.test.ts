import { describe, expect, it } from "vitest";
import {
  buildNotificationEmailHtml,
  buildNotificationEmailSubject,
  getNotificationEmailTheme,
  shouldEmailNotificationType,
  splitEmailBody,
} from "../lib/email/notification-mail-rules";
import { getResendEmailConfig } from "../lib/email/config";

describe("notification email rules", () => {
  it("emails task, leave, and punch events only", () => {
    expect(shouldEmailNotificationType("task_assigned")).toBe(true);
    expect(shouldEmailNotificationType("task_overdue")).toBe(true);
    expect(shouldEmailNotificationType("leave_requested")).toBe(true);
    expect(shouldEmailNotificationType("leave_approved")).toBe(true);
    expect(shouldEmailNotificationType("leave_rejected")).toBe(true);
    expect(shouldEmailNotificationType("punch_out_correction_requested")).toBe(
      true,
    );
    expect(shouldEmailNotificationType("punch_in_correction_approved")).toBe(
      true,
    );
    expect(shouldEmailNotificationType("punch_out_correction_rejected")).toBe(
      true,
    );
    expect(shouldEmailNotificationType("work_update_reminder")).toBe(false);
    expect(shouldEmailNotificationType("task_completed")).toBe(false);
  });

  it("builds a professional HTML template with badge and CTA", () => {
    const html = buildNotificationEmailHtml({
      title: "Leave Approved",
      body: 'Your leave for 08 Sep was approved.\nReason: <script>alert(1)</script>',
      type: "leave_approved",
      appUrl: "https://app.example.com",
    });
    expect(html).toContain("Leave Approved");
    expect(html).toContain("Approved");
    expect(html).toContain("Open in DevSync");
    expect(html).toContain("https://app.example.com/dashboard");
    expect(html).toContain("Reason");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("uses cleaner subjects and type-specific themes", () => {
    expect(buildNotificationEmailSubject("Leave Approved")).toBe(
      "Leave Approved · DevSync",
    );
    expect(getNotificationEmailTheme("leave_rejected").badge).toBe("Rejected");
    expect(getNotificationEmailTheme("task_assigned").badge).toBe("New task");
    expect(splitEmailBody("Denied.\nReason: Busy day").reason).toBe("Busy day");
  });
});

describe("Resend config", () => {
  it("returns null when Resend env is missing", () => {
    const previous = {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    };
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    expect(getResendEmailConfig()).toBeNull();
    process.env.RESEND_API_KEY = previous.RESEND_API_KEY;
    process.env.RESEND_FROM_EMAIL = previous.RESEND_FROM_EMAIL;
  });
});
