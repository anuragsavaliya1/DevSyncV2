/** Admin-only user listing endpoint for the upcoming People & Roles workspace. */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { listUsers } from "@/lib/users";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ users: await listUsers() });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
