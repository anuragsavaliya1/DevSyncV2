# DevSync browser push with Firebase Cloud Messaging

DevSync can show **browser notifications** for the same events that send email:

- Task assigned
- Task overdue (to the assigner — Manager/Admin)
- Leave requested / approved / rejected
- Punch correction requested / approved / rejected

In-app Signal Center notifications always work. Browser push is optional and never blocks Task / Leave / Punch actions.

## How it works

1. After login, the workspace asks the browser for notification permission.
2. Firebase Messaging creates an FCM token for that browser.
3. The token is saved on the user document (`fcmTokens[]`) via `POST /api/notifications/push-token`.
4. When an eligible event happens, the server:
   - writes the Signal Center notification
   - emails via Resend (if configured)
   - pushes via Firebase Admin FCM (if the user has tokens)

## 1. Firebase Console setup

1. Open [Firebase Console](https://console.firebase.google.com) → your DevSync project.
2. Go to **Project settings** → **Cloud Messaging**.
3. Under **Web Push certificates**, generate a key pair (or use existing).
4. Copy the **Key pair** value — this is your VAPID key.
5. Also note **Sender ID** (Cloud Messaging API / Sender ID).

## 2. Environment variables

Add these next to your existing Firebase public keys:

```env
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BIxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Optional (used for notification click → open dashboard):

```env
DEVSYNC_APP_URL=https://your-devsync-host.example.com
```

You already need:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
FIREBASE_SERVICE_ACCOUNT_JSON=...
```

`FIREBASE_SERVICE_ACCOUNT_JSON` must be from the same Firebase project (Admin SDK sends FCM).

## 3. Restart the app

```bash
pnpm dev
```

Or restart production so env vars reload.

## 4. Enable in the browser

1. Sign in to DevSync.
2. When prompted, click **Allow** for notifications.
3. Keep at least one tab of DevSync open once (token registration), then you can close it — background push still works via the service worker.

## 5. Verify

1. From another account, assign a task / approve leave / review a punch request for the user who allowed notifications.
2. Confirm:
   - Signal Center still updates
   - Email still sends (if Resend is configured)
   - A browser notification appears (even if DevSync is in background)

## 6. Code map

| File | Role |
|------|------|
| `lib/push/notification-push.ts` | Server FCM send (fire-and-forget) |
| `lib/push/notification-push-rules.ts` | Same event allowlist as email |
| `lib/operations.ts` | Calls push next to email after notification insert |
| `lib/users.ts` | `fcmTokens` save / list / remove |
| `app/api/notifications/push-token/route.ts` | Register / unregister token |
| `app/api/firebase-messaging-sw/route.ts` | Service worker script |
| `features/notifications/hooks/use-register-browser-push.ts` | Client permission + token registration |
| `next.config.ts` | Rewrites `/firebase-messaging-sw.js` |

## Notes

- If FCM env vars are missing, push is skipped silently; nothing else breaks.
- Invalid/expired tokens are removed automatically after failed FCM sends.
- HTTPS is required for browser push in production (localhost is allowed for development).
- Optional icon path: `/icon-192.png` (add under `public/` if you want a branded badge).
