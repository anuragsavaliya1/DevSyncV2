/** Manager/Admin manual punch-out for an employee with an open attendance record. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/api-errors";
import { manuallyPunchOutEmployee } from "@/lib/operations";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const manualSchema = z.object({
  userId: z.string().min(1),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  punchOutAt: z.string().datetime({ offset: true }),
  reason: z.string().min(1).max(2000),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const body = manualSchema.parse(await request.json());
    const attendance = await manuallyPunchOutEmployee(user, {
      userId: body.userId,
      workDate: body.workDate,
      punchOutAt: new Date(body.punchOutAt),
      reason: body.reason,
    });
    return NextResponse.json({ attendance });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid manual punch-out request." },
        { status: 400 },
      );
    }
    const { error: message, status } = apiError(
      error,
      "Could not record manual punch-out.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}
