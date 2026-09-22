/** Manager/Admin rejection of a pending punch-out correction request. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/api-errors";
import { rejectPunchOutCorrectionRequest } from "@/lib/operations";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const rejectSchema = z.object({
  reviewNote: z.string().min(1).max(2000),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { requestId } = await context.params;
    const body = rejectSchema.parse(await request.json());
    const correction = await rejectPunchOutCorrectionRequest(
      user,
      requestId,
      body.reviewNote,
    );
    return NextResponse.json({ request: correction });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "A review note is required." },
        { status: 400 },
      );
    }
    const { error: message, status } = apiError(
      error,
      "Could not reject punch-out correction.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}
