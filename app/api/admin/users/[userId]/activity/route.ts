/** Admin-only employee activation lifecycle endpoint; historical documents remain intact. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-errors";
import { getCurrentUser } from "@/lib/session";
import { changeUserActivity } from "@/lib/users";

export const runtime = "nodejs";
const activitySchema = z.object({ isActive: z.boolean() });

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
    const { isActive } = activitySchema.parse(await request.json());
    return NextResponse.json({
      user: await changeUserActivity({ actor, targetUserId: userId, isActive }),
    });
  } catch (error) {
    const failure = apiError(error, "Unable to update employee access.");
    return NextResponse.json(
      { error: failure.error },
      { status: failure.status }
    );
  }
}
