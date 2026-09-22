/** Admin-only permanent employee deletion endpoint. */
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-errors";
import { getCurrentUser } from "@/lib/session";
import { permanentlyDeleteUser } from "@/lib/users";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const actor = await getCurrentUser();
  if (!actor)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (actor.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { userId } = await context.params;
    await permanentlyDeleteUser({ actor, targetUserId: userId });
    return NextResponse.json({ success: true });
  } catch (error) {
    const failure = apiError(error, "Unable to permanently delete employee.");
    return NextResponse.json(
      { error: failure.error },
      { status: failure.status }
    );
  }
}
