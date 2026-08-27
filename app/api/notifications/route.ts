/** Notification drawer API with persisted read states. */
import { NextRequest, NextResponse } from "next/server";
import { listNotifications, markNotificationsRead } from "@/lib/operations";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    return NextResponse.json({ notifications: await listNotifications(user.id) });
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    await markNotificationsRead(user.id, typeof body.notificationId === "string" ? body.notificationId : undefined);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
}
