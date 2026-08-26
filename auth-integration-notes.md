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

References:

- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/identity/sign-in/web/backend-auth
- https://nextjs.org/docs/app
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/auth/admin/verify-id-tokens
