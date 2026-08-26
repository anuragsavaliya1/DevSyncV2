/** DevSync v2 health endpoint; it intentionally reveals configuration state but never secret values. */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    application: "devsync-v2",
    status: "ok",
    services: {
      mongodb: Boolean(process.env.MONGODB_URI),
      googleOAuth: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
  });
}
