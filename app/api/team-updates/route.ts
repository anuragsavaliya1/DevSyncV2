/** Manager/Admin daily compliance view: real employee directory joined with submitted MongoDB work updates. */
import { NextRequest, NextResponse } from "next/server";
import { isAttendanceTrackedRole } from "@/lib/auth/permissions";
import { indiaDateKey, listWorkUpdates } from "@/lib/operations";
import { listResponseWithOptionalPaging } from "@/lib/pagination";
import { getCurrentUser } from "@/lib/session";
import { listUsers } from "@/lib/users";

export const runtime = "nodejs";

type TeamActivityFilter = "all" | "active" | "inactive";

function activityFromQuery(value: string | null): TeamActivityFilter {
  if (value === "all" || value === "inactive") return value;
  return "active";
}

export async function GET(request: NextRequest) {
  const viewer = await getCurrentUser();
  if (!viewer)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    if (viewer.role !== "admin" && viewer.role !== "manager")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const workDate =
      request.nextUrl.searchParams.get("workDate") || indiaDateKey();
    const activity = activityFromQuery(
      request.nextUrl.searchParams.get("activity"),
    );
    const [users, updates] = await Promise.all([
      listUsers(),
      listWorkUpdates({ updateDate: workDate }),
    ]);
    const updatesByUserId = new Map(
      updates.map(update => [update.userId, update])
    );
    const members = users
      .filter(user => {
        if (!isAttendanceTrackedRole(user.role)) return false;
        if (activity === "active") return user.isActive;
        if (activity === "inactive") return !user.isActive;
        return true;
      })
      .map(user => ({ user, update: updatesByUserId.get(user.id) || null }));
    const summary = {
      submitted: members.filter((member) => member.update).length,
      total: members.length,
    };
    return NextResponse.json({
      workDate,
      activity,
      summary,
      ...listResponseWithOptionalPaging(
        "members",
        members,
        request.nextUrl.searchParams,
      ),
    });
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
}
