/** Manager/Admin rejection of a pending leave request (reason required). */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/api-errors";
import { rejectLeaveRequest } from "@/lib/operations";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const rejectSchema = z.object({
  rejectionReason: z.string().min(1).max(2000),
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
    const leaveRequest = await rejectLeaveRequest(
      user,
      requestId,
      body.rejectionReason,
    );
    return NextResponse.json({ request: leaveRequest });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "A rejection reason is required." },
        { status: 400 },
      );
    }
    const { error: message, status } = apiError(
      error,
      "Could not reject leave request.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}
