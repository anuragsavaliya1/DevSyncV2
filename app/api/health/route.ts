/** DevSync v2 health endpoint; it intentionally reveals configuration state but never secret values. */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    application: "devsync-v2",
    status: "ok",
    services: {
      mongodb: Boolean(process.env.MONGODB_URI),
      firebaseAuthentication: Boolean(
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON &&
        process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
        process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      ),
    },
  });
}
