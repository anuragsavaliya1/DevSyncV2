/** Manager/Admin team attendance endpoint: employee directory joined with server-recorded punch metadata. */
import { NextRequest, NextResponse } from "next/server";
import {
  indiaDateKey,
  listTeamAttendanceRows,
  type TeamAttendanceActivityFilter,
} from "@/lib/operations";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

function activityFromQuery(value: string | null): TeamAttendanceActivityFilter {
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
    return NextResponse.json({
      workDate,
      activity,
      rows: await listTeamAttendanceRows(workDate, activity),
    });
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
}
