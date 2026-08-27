/** Attendance API: authenticated self-service punches; Managers and Admins may read team records. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canViewTeamData, getAttendanceForUserDate, indiaDateKey, listAttendance, punchIn, punchOut } from "@/lib/operations";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const actionSchema = z.object({ action: z.enum(["punch_in", "punch_out"]) });

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const search = request.nextUrl.searchParams;
    const requestedUserId = search.get("userId") || user.id;
    if (requestedUserId !== user.id && !canViewTeamData(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (search.get("team") === "true" && !canViewTeamData(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const workDate = search.get("workDate") || indiaDateKey();
    if (search.get("team") === "true") return NextResponse.json({ attendance: await listAttendance({ workDate }) });
    return NextResponse.json({ attendance: await getAttendanceForUserDate(requestedUserId, workDate) });
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { action } = actionSchema.parse(await request.json());
    const device = { ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip"), userAgent: request.headers.get("user-agent") };
    const attendance = action === "punch_in" ? await punchIn(user, device) : await punchOut(user);
    return NextResponse.json({ attendance });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Attendance action failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
