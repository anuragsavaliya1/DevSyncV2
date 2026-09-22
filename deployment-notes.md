# Deployment Notes

## Managed-hosting incident — 27 August 2026

The managed deployment completed `next build` successfully, then failed in the obsolete static upload stage because it expected `dist/public/*`. This repository is a dynamic Next.js App Router application with server-side Firebase verification and MongoDB APIs; its intended build artifact is `.next`, not the retired Vite `dist/public` tree.

The stale project metadata was changed from `web-static` to the already-enabled `web-db-user` service contract. As the managed builder continued selecting the legacy static uploader, a complete root `Dockerfile` was added to take responsibility for the Node 22 build and runtime. It installs the lockfile dependencies, runs the existing production Next build, sets production mode, and starts `next start` through the `pnpm start` command on the platform-provided `PORT`.

The managed builder still appends its legacy static-upload step even when a custom container is present. The Docker build therefore creates a non-empty `dist/public/index.html` compatibility marker **after** the Next build. That marker only prevents an irrelevant glob failure; the container remains responsible for serving the actual Next.js application from `.next` and its dynamic API routes.

The corrected deployment succeeded and assigned the stable temporary hostname `devsyncui-jugwbhqd.manus.space`. The final remaining production prerequisite is to add this exact hostname to Firebase Authentication’s Authorized domains list, then re-run Google sign-in against that production address.

Post-deployment runtime verification confirmed `https://devsyncui-jugwbhqd.manus.space/api/health` returns the expected live DevSync JSON health response with MongoDB and Firebase Authentication configured. The host root redirects to and renders the actual Next.js DevSync login page, not the compatibility marker. This confirms the application is running from the Next.js container.

The Firebase console was opened at `https://console.firebase.google.com/project/devsync-75aa7/authentication/settings`. The **Authorized domains** control is available in Authentication → Settings → Domains. The user approved adding `devsyncui-jugwbhqd.manus.space`; the pending action is to add that exact hostname, then test Google sign-in on the published host.

The hostname was added successfully and now appears as a Firebase custom Authorized domain. On the published native sign-in page, the user-approved Google popup flow opened and returned to the production origin. The page then progressed to `Creating your protected DevSync session…`; the final session exchange has not yet completed and is being investigated before the production sign-in check is marked complete.

The production session exchange completed successfully. The published host rendered the authenticated Admin workspace, and `https://devsyncui-jugwbhqd.manus.space/api/auth/me` returned the existing active Admin profile with the expected Admin role. Google identity, server-verified DevSync session cookies, MongoDB profile lookup, and the published Next.js runtime are therefore verified end to end on the assigned temporary domain.

Local verification completed on 27 August 2026: the production build passed, `.next/BUILD_ID` and `.next/server` were present, the server started successfully on `PORT=3100`, `/api/health` returned `200` with MongoDB and Firebase Authentication configured, and `/login` returned `200`. No secret values are stored in this document or the Dockerfile.

## Optional Resend email (Signal Center events)

DevSync can email the same events shown in Notifications (task assign, leave request/approve/reject, punch correction request/approve/reject) via [Resend](https://resend.com).

Full setup guide: [`docs/resend-email-setup.md`](docs/resend-email-setup.md)

Required environment variables:

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=DevSync <noreply@your-domain.com>
```

Optional (enables the “Open in DevSync” button in emails):

```
DEVSYNC_APP_URL=https://your-devsync-host.example.com
```

If either Resend value is missing, in-app notifications still work and email is skipped with a server log line. Email failures never block the original Task / Leave / Punch action. Old `SMTP_*` variables are unused.

## Optional Firebase browser push

Same events can also appear as browser notifications. Setup: [`docs/firebase-browser-push-setup.md`](docs/firebase-browser-push-setup.md)

```
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=...
```

Missing values only disable push; Signal Center and email keep working.

## Official timestamps (server only)

Punch in/out, attendance creation, work-update submission, task completion, and notification creation use **MongoDB server time** via `serverNow()` — never the browser clock and never a client-supplied timestamp. The attendance punch API accepts only `{ action }` (strict). Live clocks / countdown UI may still use the browser for display.

Changing a laptop’s system time therefore cannot forge official punch times when the app talks to MongoDB Atlas (or any NTP-synced Mongo host).

