/** Attendance API: self-service punches, day lookup, and employee month ledger. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidMonthKey } from "@/lib/attendance-month";
import {
  canViewTeamData,
  getAttendanceMonthLedger,
  getAttendanceWithAudit,
  indiaDateKey,
  listAttendance,
  punchIn,
  punchOut,
} from "@/lib/operations";
import { listResponseWithOptionalPaging } from "@/lib/pagination";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const actionSchema = z
  .object({ action: z.enum(["punch_in", "punch_out"]) })
  .strict();

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const search = request.nextUrl.searchParams;
    const month = search.get("month");
    if (month) {
      if (!isValidMonthKey(month))
        return NextResponse.json({ error: "Invalid month." }, { status: 400 });
      // Month ledger is always self-scoped — ignore any browser-supplied userId.
      return NextResponse.json({
        ledger: await getAttendanceMonthLedger(user, month),
      });
    }

    const requestedUserId = search.get("userId") || user.id;
    if (requestedUserId !== user.id && !canViewTeamData(user))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (search.get("team") === "true" && !canViewTeamData(user))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const workDate = search.get("workDate") || indiaDateKey();
    if (search.get("team") === "true")
      return NextResponse.json(
        listResponseWithOptionalPaging(
          "attendance",
          await listAttendance({ workDate }),
          search,
        ),
      );
    return NextResponse.json({
      attendance: await getAttendanceWithAudit(requestedUserId, workDate),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load attendance.";
    if (message === "Invalid month.")
      return NextResponse.json({ error: message }, { status: 400 });
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { action } = actionSchema.parse(await request.json());
    const device = {
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    };
    const attendance =
      action === "punch_in"
        ? await punchIn(user, device)
        : await punchOut(user);
    return NextResponse.json({ attendance });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Attendance action failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
