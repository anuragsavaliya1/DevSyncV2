# Deployment Notes

## Managed-hosting incident — 27 August 2026

The managed deployment completed `next build` successfully, then failed in the obsolete static upload stage because it expected `dist/public/*`. This repository is a dynamic Next.js App Router application with server-side Firebase verification and MongoDB APIs; its intended build artifact is `.next`, not the retired Vite `dist/public` tree.

The stale project metadata was changed from `web-static` to the already-enabled `web-db-user` service contract. As the managed builder continued selecting the legacy static uploader, a complete root `Dockerfile` was added to take responsibility for the Node 22 build and runtime. It installs the lockfile dependencies, runs the existing production Next build, sets production mode, and starts `next start` through the `pnpm start` command on the platform-provided `PORT`.

Local verification completed on 27 August 2026: the production build passed, `.next/BUILD_ID` and `.next/server` were present, the server started successfully on `PORT=3100`, `/api/health` returned `200` with MongoDB and Firebase Authentication configured, and `/login` returned `200`. No secret values are stored in this document or the Dockerfile.
