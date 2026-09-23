/** Admin-only user listing endpoint for the upcoming People & Roles workspace. */
import { NextRequest, NextResponse } from "next/server";
import { listResponseWithOptionalPaging } from "@/lib/pagination";
import { getCurrentUser } from "@/lib/session";
import { listUsers } from "@/lib/users";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (user.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const users = await listUsers();
    return NextResponse.json(
      listResponseWithOptionalPaging(
        "users",
        users,
        request.nextUrl.searchParams,
      ),
    );
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
