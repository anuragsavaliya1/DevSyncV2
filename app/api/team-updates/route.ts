/** Manager/Admin daily compliance view: real employee directory joined with submitted MongoDB work updates. */
import { NextRequest, NextResponse } from "next/server";
import { indiaDateKey, listWorkUpdates } from "@/lib/operations";
import { getCurrentUser } from "@/lib/session";
import { listUsers } from "@/lib/users";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    if (viewer.role !== "admin" && viewer.role !== "manager") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const workDate = request.nextUrl.searchParams.get("workDate") || indiaDateKey();
    const [users, updates] = await Promise.all([listUsers(), listWorkUpdates({ updateDate: workDate })]);
    const updatesByUserId = new Map(updates.map((update) => [update.userId, update]));
    return NextResponse.json({
      workDate,
      members: users.filter((user) => user.isActive).map((user) => ({ user, update: updatesByUserId.get(user.id) || null })),
    });
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
}
