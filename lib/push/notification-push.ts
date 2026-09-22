/** Firebase Cloud Messaging (browser push) delivery for DevSync events. */
import "server-only";
import { getMessaging } from "firebase-admin/messaging";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  buildPushNotificationPayload,
  shouldPushNotificationType,
} from "@/lib/push/notification-push-rules";
import {
  listUserFcmTokens,
  removeUserFcmTokens,
} from "@/lib/users";

function resolveAppUrl() {
  const value =
    process.env.DEVSYNC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  return value || null;
}

/**
 * Send data-only web push.
 * Including a top-level / webpush `notification` payload makes FCM auto-display
 * the alert AND our service worker also calls showNotification → duplicates.
 */
export async function sendNotificationPush(input: {
  recipientUserId: string;
  type: string;
  title: string;
  body: string;
}) {
  if (!shouldPushNotificationType(input.type)) {
    return { sent: false as const, reason: "type_skipped" as const };
  }

  const tokens = [...new Set(await listUserFcmTokens(input.recipientUserId))];
  if (!tokens.length) {
    return { sent: false as const, reason: "no_tokens" as const };
  }

  const payload = buildPushNotificationPayload({
    title: input.title,
    body: input.body,
    type: input.type,
    appUrl: resolveAppUrl(),
  });

  try {
    const messaging = getMessaging(getFirebaseAdmin());
    const response = await messaging.sendEachForMulticast({
      tokens,
      data: {
        type: payload.data.type,
        title: payload.data.title,
        body: payload.data.body,
        url: payload.data.url,
        tag: payload.data.tag,
      },
      webpush: {
        fcmOptions: {
          link: payload.data.url,
        },
        headers: {
          Urgency: "high",
        },
      },
    });

    const staleTokens: string[] = [];
    response.responses.forEach((result, index) => {
      if (!result.success) {
        const code = result.error?.code || "";
        if (
          code.includes("registration-token-not-registered") ||
          code.includes("invalid-registration-token")
        ) {
          staleTokens.push(tokens[index]!);
        }
      }
    });
    if (staleTokens.length) {
      await removeUserFcmTokens(input.recipientUserId, staleTokens);
    }

    return {
      sent: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[push] FCM send failed:", message);
    return { sent: false as const, reason: "failed" as const, error: message };
  }
}

/** Fire-and-forget so notification writes never fail because of FCM. */
export function scheduleNotificationPush(input: {
  recipientUserId: string;
  type: string;
  title: string;
  body: string;
}) {
  void sendNotificationPush(input).catch((error) => {
    console.error(
      "[push] notification push failed:",
      error instanceof Error ? error.message : "unknown error",
    );
  });
}
