/** Map in-app notification events to optional email delivery. */
import "server-only";
import { sendAppEmail } from "@/lib/email/mailer";
import {
  buildNotificationEmailHtml,
  buildNotificationEmailSubject,
  buildNotificationEmailText,
  shouldEmailNotificationType,
} from "@/lib/email/notification-mail-rules";
import { getUserById } from "@/lib/users";

export {
  EMAIL_NOTIFICATION_TYPES,
  buildNotificationEmailHtml,
  buildNotificationEmailSubject,
  buildNotificationEmailText,
  shouldEmailNotificationType,
} from "@/lib/email/notification-mail-rules";

function resolveAppUrl() {
  const value =
    process.env.DEVSYNC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  return value || null;
}

export async function sendNotificationEmail(input: {
  recipientUserId: string;
  type: string;
  title: string;
  body: string;
  recipientEmail?: string | null;
}) {
  if (!shouldEmailNotificationType(input.type)) {
    return { sent: false as const, reason: "type_skipped" as const };
  }

  let email = input.recipientEmail?.trim() || null;
  if (!email) {
    const user = await getUserById(input.recipientUserId);
    email = user?.email ?? null;
  }
  if (!email) {
    return { sent: false as const, reason: "no_recipient" as const };
  }

  const appUrl = resolveAppUrl();

  return sendAppEmail({
    to: email,
    subject: buildNotificationEmailSubject(input.title),
    text: buildNotificationEmailText({
      title: input.title,
      body: input.body,
      appUrl,
    }),
    html: buildNotificationEmailHtml({
      title: input.title,
      body: input.body,
      type: input.type,
      appUrl,
    }),
  });
}

/** Fire-and-forget so notification writes never fail because of email delivery. */
export function scheduleNotificationEmail(input: {
  recipientUserId: string;
  type: string;
  title: string;
  body: string;
  recipientEmail?: string | null;
}) {
  void sendNotificationEmail(input).catch((error) => {
    console.error(
      "[email] notification mail failed:",
      error instanceof Error ? error.message : "unknown error",
    );
  });
}
