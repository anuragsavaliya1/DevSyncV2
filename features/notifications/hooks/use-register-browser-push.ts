"use client";

import { useEffect } from "react";
import {
  registerPushToken,
} from "@/features/notifications/api/push-token-api";
import {
  firebaseApp,
  isFirebaseMessagingConfigured,
} from "@/lib/firebase/client";

const TOKEN_STORAGE_KEY = "devsync_fcm_token";

/** One browser push setup per page lifetime (avoids Strict Mode double subscribe). */
let setupPromise: Promise<void> | null = null;
let foregroundListenerAttached = false;

async function ensureBrowserPushSetup() {
  if (setupPromise) return setupPromise;

  setupPromise = (async () => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (!isFirebaseMessagingConfigured()) return;

    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
    if (permission !== "granted") return;

    const { getMessaging, getToken, isSupported, onMessage } =
      await import("firebase/messaging");
    if (!(await isSupported())) return;

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" },
    );
    await navigator.serviceWorker.ready;

    const messaging = getMessaging(firebaseApp);
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!.trim();
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return;

    // Idempotent server-side ($addToSet). Always sync so wiped tokens recover.
    await registerPushToken(token);
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);

    // Foreground data-only pushes are not auto-shown — attach once.
    if (!foregroundListenerAttached) {
      foregroundListenerAttached = true;
      onMessage(messaging, (payload) => {
        const title =
          payload.data?.title ||
          payload.notification?.title ||
          "DevSync";
        const body =
          payload.data?.body || payload.notification?.body || "";
        const tag =
          payload.data?.tag ||
          `devsync-${payload.data?.type || "notice"}`;
        if (Notification.permission === "granted") {
          new Notification(title, {
            body,
            icon: "/icon-192.png",
            tag,
            data: payload.data,
          });
        }
      });
    }
  })().catch((error) => {
    setupPromise = null;
    console.info(
      "[push] browser registration skipped:",
      error instanceof Error ? error.message : "unknown error",
    );
  });

  return setupPromise;
}

/**
 * Registers the browser for Firebase web push after login.
 * No-ops when FCM env is missing or Notification permission is denied.
 * Does not affect Signal Center or email flows.
 */
export function useRegisterBrowserPush(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    void ensureBrowserPushSetup();
  }, [enabled]);
}
