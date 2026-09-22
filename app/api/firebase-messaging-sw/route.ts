/** Serves the FCM service worker with public Firebase config injected. */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  };

  const script = `/* DevSync Firebase messaging service worker */
importScripts('https://www.gstatic.com/firebasejs/12.3.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.3.0/firebase-messaging-compat.js');

firebase.initializeApp(${JSON.stringify(config)});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = data.title || payload.notification?.title || 'DevSync';
  const body = data.body || payload.notification?.body || '';
  const link = data.url || '/dashboard';
  const tag = data.tag || ('devsync-' + (data.type || 'notice'));
  // Data-only messages: we own display. Do not also rely on FCM auto-notification.
  return self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag,
    renotify: false,
    data: { url: link, ...data },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
`;

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
