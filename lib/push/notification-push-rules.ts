/** Pure browser-push rules — same event allowlist as email. */
import { notificationHref } from "@/lib/notification-nav-rules";
export {
  EMAIL_NOTIFICATION_TYPES as PUSH_NOTIFICATION_TYPES,
  shouldEmailNotificationType as shouldPushNotificationType,
} from "@/lib/email/notification-mail-rules";

/** Stable tag so identical pushes replace instead of stacking. */
export function buildPushNotificationTag(type: string, body: string) {
  const compact = body.replace(/\s+/g, " ").trim().slice(0, 48);
  return `devsync-${type}-${compact}`.slice(0, 64);
}

export function buildPushNotificationPayload(input: {
  title: string;
  body: string;
  type: string;
  appUrl?: string | null;
}) {
  const summary = input.body.split("\nReason:")[0]?.trim() || input.body.trim();
  const path = notificationHref(input.type);
  const link = input.appUrl
    ? `${input.appUrl.replace(/\/+$/, "")}${path}`
    : path;
  const body = summary.slice(0, 180);
  return {
    title: input.title,
    body,
    tag: buildPushNotificationTag(input.type, body),
    data: {
      type: input.type,
      title: input.title,
      body: summary.slice(0, 500),
      url: link,
      tag: buildPushNotificationTag(input.type, body),
    },
  };
}
