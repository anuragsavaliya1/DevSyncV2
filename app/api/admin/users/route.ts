/** Admin-only user listing endpoint for the upcoming People & Roles workspace. */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { listUsers } from "@/lib/users";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (user.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    return NextResponse.json({ users: await listUsers() });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
