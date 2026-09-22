/** Notification drawer API with persisted read states, delete, and pagination. */
import { NextRequest, NextResponse } from "next/server";
import {
  canViewTeamData,
  clearAllNotifications,
  deleteNotification,
  listNotifications,
  markNotificationsRead,
  maybeNotifyOverdueAssignedTasks,
} from "@/lib/operations";
import { getCurrentUser } from "@/lib/session";
import { QUERY_CONFIG } from "@/constants/query-config";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    // Managers/Admins: create overdue assigner notifications before listing,
    // so Signal Center shows them without waiting only on cron.
    if (canViewTeamData(user)) {
      try {
        await maybeNotifyOverdueAssignedTasks();
      } catch (error) {
        console.error(
          "[task-overdue] interactive sweep failed",
          error instanceof Error ? error.message : "unknown error",
        );
      }
    }

    const limitParam = request.nextUrl.searchParams.get("limit");
    const cursor = request.nextUrl.searchParams.get("cursor");
    const parsedLimit = limitParam ? Number(limitParam) : undefined;
    const limit =
      parsedLimit && Number.isFinite(parsedLimit)
        ? parsedLimit
        : QUERY_CONFIG.notifications.pageSize;
    const result = await listNotifications(user.id, {
      limit,
      cursor: cursor || null,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    await markNotificationsRead(
      user.id,
      typeof body.notificationId === "string" ? body.notificationId : undefined
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const clearAll = request.nextUrl.searchParams.get("all") === "true";
    if (clearAll) {
      const result = await clearAllNotifications(user.id);
      return NextResponse.json({ success: true, ...result });
    }
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Notification id is required." },
        { status: 400 },
      );
    }
    const result = await deleteNotification(user.id, id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not delete notification.";
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
