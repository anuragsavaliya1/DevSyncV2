# DevSync v2 Next.js Checklist

- [x] Collect the MongoDB Atlas connection string through project secrets, not application code or browser storage.
- [x] Collect Firebase web-app configuration and Firebase Admin service-account credentials for Google-only authentication.
- [x] Enable Google as the only Firebase Authentication sign-in provider and register the DevSync development authorised domain.
- [ ] Register the final production DevSync domain in Firebase Authentication authorised domains before publishing.
- [x] Add the initial Admin email to the server-side allow-list; new accounts otherwise begin as Developer and may be promoted by an Admin.
- [x] Create a clean latest-Next.js application using the existing Vite UI only as the approved visual reference.
- [x] Create a clean MongoDB database and configure its credentials only as server-side secrets.
- [x] Implement Firebase ID-token verification in protected Next.js route handlers for authenticated application procedures and future mobile clients.
- [x] Define clean MongoDB document models for employees and roles, attendance, work updates, assigned tasks with embedded remarks, notifications, and audit events.
- [x] Specify server-authorized permissions for Developer, Manager, and Admin actions.
- [x] Replace all demo arrays with authenticated API reads and writes against the new MongoDB database.
- [x] Implement live operational updates, validation rules, attendance device metadata, and notification read states.
- [ ] Defer Firestore export and migration work until the clean DevSync v2 workflows are approved in production.
- [ ] Test access boundaries, destructive actions, real-time flows, mobile behavior, and operational error states.
