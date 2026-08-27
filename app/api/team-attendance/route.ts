/** Manager/Admin team attendance endpoint: employee directory joined with server-recorded punch metadata. */
import { NextRequest, NextResponse } from "next/server";
import { indiaDateKey, listAttendance } from "@/lib/operations";
import { getCurrentUser } from "@/lib/session";
import { listUsers } from "@/lib/users";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    if (viewer.role !== "admin" && viewer.role !== "manager") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const workDate = request.nextUrl.searchParams.get("workDate") || indiaDateKey();
    const [users, attendance] = await Promise.all([listUsers(), listAttendance({ workDate })]);
    const byUserId = new Map(attendance.map((record) => [record.userId, record]));
    return NextResponse.json({ workDate, rows: users.filter((user) => user.isActive).map((user) => ({ user, attendance: byUserId.get(user.id) || null })) });
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
}
