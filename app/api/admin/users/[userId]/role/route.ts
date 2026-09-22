/** Admin-only role mutation with a persistent MongoDB audit record. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { changeUserRole } from "@/lib/users";

export const runtime = "nodejs";

const roleSchema = z.object({
  role: z.enum(["developer", "manager", "admin"]),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const actor = await getCurrentUser();
  if (!actor)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (actor.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { userId } = await context.params;
    const { role } = roleSchema.parse(await request.json());
    const user = await changeUserRole({ actor, targetUserId: userId, role });
    return NextResponse.json({ user });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update role.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
