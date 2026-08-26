/** Admin-only role mutation with a persistent MongoDB audit record. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { changeUserRole } from "@/lib/users";

export const runtime = "nodejs";

const roleSchema = z.object({ role: z.enum(["developer", "manager", "admin"]) });

export async function PATCH(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  try {
    const actor = await requireAdmin();
    const { userId } = await context.params;
    const { role } = roleSchema.parse(await request.json());
    const user = await changeUserRole({ actor, targetUserId: userId, role });
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update role.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
