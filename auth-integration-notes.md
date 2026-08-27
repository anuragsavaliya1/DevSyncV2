# DevSync Google Authentication Requirements

Google-only sign-in will use a web application OAuth client. The production OAuth redirect URI must exactly match the URI registered in Google Cloud, including scheme, case, path, and trailing slash. OAuth credentials must be stored as server-side secrets and never placed in browser code or committed to the repository.

The backend will verify Google-issued identity tokens before creating a DevSync session. Verification includes the token signature, audience, issuer, expiry, and verified email. The application will persist Google subject ID as the immutable identity key, with email and display name as profile attributes. The allow-listed initial Admin email will be assigned the Admin role on first approved sign-in; subsequent role changes will remain server-authorized and audit logged.

## Next.js v2 stack decision inputs

The current official Next.js App Router documentation identifies version 16.3.3 as the latest stable version and supports server components, server functions, route handlers, and cookie-aware server logic. The DevSync v2 application will target the App Router rather than migrate the Vite client application in place.

Firebase Authentication is the approved Google-only identity layer. The browser will use the Firebase JavaScript SDK, with Google enabled as the only Firebase Authentication provider. After sign-in, a Firebase ID token is sent only over HTTPS to the Next.js backend. The Firebase Admin SDK must verify that token before the application reads or changes any MongoDB record. The verified Firebase `uid` is the immutable identity key stored in DevSync's MongoDB user collection.

MongoDB Atlas remains the sole operational database. Firebase Authentication does not own DevSync roles, attendance, work updates, tasks, notifications, or audit events.

## Verified project setup

On 26 August 2026, the DevSync Firebase project was verified in the Firebase Console: Firebase Authentication is initialized and **Google** is the sole enabled sign-in provider. The project currently has a development environment only. Its final production domain must be added to Firebase Authentication's authorized domains before release.

The DevSync v2 Google sign-in page loads successfully in the configured development environment. Browser-based identity completion remains the final verification step because it opens a Google-controlled authentication popup and creates the first live DevSync user only after the approved Google account completes that flow.

## Google sign-in blocker diagnosis

On 26 August 2026, Firebase Authentication's authorized-domain list was checked. It contains only `localhost`, `devsync-75aa7.firebaseapp.com`, and `devsync-75aa7.web.app`. The current DevSync Next.js preview hostname is absent. Firebase therefore blocks the preview from completing Google OAuth. The preview hostname must be added as an authorized domain; the final public DevSync domain will need the same configuration before publishing.

The approved preview hostname `3000-it25cf44ppm9qho4ebqnv-95cf2949.us4.manus.computer` was added as a custom authorized domain on 26 August 2026. The Firebase Console confirmed that addition. Google sign-in must now be re-tested from the DevSync login page.

The browser automation can trigger the DevSync Google sign-in button but does not surface a Google-controlled popup window in its page inspection output. A manual click in the same already-authorized preview browser is required to complete the final identity interaction and establish the first Firebase-backed DevSync session.

## Native fallback verification

The framework-independent `/login/native` fallback was tested on 26 August 2026. Its user-triggered browser-native Firebase module successfully navigated from the DevSync preview to Firebase’s auth handler and then to the Google account chooser. This proves the prior failure was the preview’s React/Firebase client interaction path, not the Google provider, Firebase project, API key, or authorized domain. The last remaining authentication check is selecting the initial Admin account and confirming the return-to-DevSync session exchange.

The native fallback was subsequently changed to Firebase's popup credential flow to preserve the Google result on the DevSync origin. Its `Start Google sign-in` button successfully opened Firebase's `signInViaPopup` handler in a separate browser window. The final user-controlled action is selecting the Google account in that popup so DevSync can exchange the resulting Firebase ID token for its server session.

On 26 August 2026, `anurag.xitijinfo@gmail.com` completed the Google popup flow. DevSync created the MongoDB user with the **Admin** role and the protected dashboard showed the authenticated account. The dashboard's operational-data panel remained in a loading state after authentication and requires a separate API/client loading diagnosis.

Direct authenticated browser checks confirmed that `/api/auth/me` returns the persisted Admin user and `/api/attendance` returns promptly with the expected empty attendance record. The session boundary and attendance endpoint are therefore working; the dashboard loader investigation continues with the remaining operational endpoints.

On 27 August 2026, the dashboard hydration indicator and Admin tab navigation were verified as live. The Role Management view still rendered an empty user list even though the authenticated Admin account exists. This is an Admin-directory query or client-load issue, not an identity/session failure.

The protected `/api/admin/users` endpoint was then verified to return the persisted initial Admin. The Role Management screen also rendered that Admin record after its real asynchronous request completed, with the initial Admin account protected from self-demotion. The initial empty state was a pre-fetch render state rather than an incorrect MongoDB query.

After the resumed validation on 27 August 2026, the authenticated Admin workspace was verified to hydrate without the prior locale-date error. Its Team Updates, Attendance, Role Management, and Notification Drawer controls all bound and rendered their MongoDB-backed empty/real states. Unauthenticated data reads returned `401` or `403`, and an unauthenticated destructive task request returned `401` before task validation. The responsive mobile sign-in view and a controlled Firebase failure view were also checked.

The live Admin Attendance ledger was kept open for a full 15-second polling interval. Its initial records completed from the MongoDB-backed team-attendance endpoint without blocking the usable workspace, and the stable refreshed ledger showed the real Admin account as absent for the current business date.

To make polling auditable without generating operational records, the workspace now shows a quiet status line with the last successful IST sync timestamp. In live Admin QA, its populated state advanced from `11:10:56 AM GMT+5:30` to `11:11:24 AM GMT+5:30` after the configured 15-second interval while the work-update form remained usable. This confirms a completed background refresh rather than only the initial fetch.

The same polling verification was then repeated on the already-populated Admin Attendance ledger. Its real row for the current Admin stayed visible, without a replacement spinner, while the sync timestamp advanced from `11:12:18 AM GMT+5:30` to `11:12:47 AM GMT+5:30` across the next 15-second cycle.

All remaining operational JSON routes were changed to use the non-redirecting session lookup before parsing a payload or calling MongoDB. A credential-free check of every protected read and mutation returned `401 {"error":"Unauthenticated"}`, including Admin role mutation and task assignment, instead of an accidental login redirect, `400`, or `403`. The active browser session still returned the real persisted Admin record from `/api/auth/me` after this refactor.

The final task-detail and task-remark audit confirmed that `PATCH` and `DELETE /api/tasks/not-a-real-id`, plus `POST /api/tasks/not-a-real-id/remarks`, all return `401` before task-ID or JSON body processing. A repository sweep then found no remaining redirect-oriented session guards under `app/api`, and the complete typecheck, six-file Vitest suite, and production build passed.

The dashboard loading display was repaired by rendering real empty states immediately while background requests complete. The reopened Admin workspace subsequently hydrated normally, and its sidebar tabs and notification drawer were verified responsive in the live browser.

References:

- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/identity/sign-in/web/backend-auth
- https://nextjs.org/docs/app
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/auth/admin/verify-id-tokens
