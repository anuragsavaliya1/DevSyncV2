/** Fetch or hard-delete a leave request. */
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/api-errors";
import { deleteLeaveRequest, getLeaveRequest } from "@/lib/operations";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { requestId } = await context.params;
    const leaveRequest = await getLeaveRequest(user, requestId);
    return NextResponse.json({ request: leaveRequest });
  } catch (error) {
    const { error: message, status } = apiError(
      error,
      "Could not load leave request.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { requestId } = await context.params;
    const result = await deleteLeaveRequest(user, requestId);
    return NextResponse.json(result);
  } catch (error) {
    const { error: message, status } = apiError(
      error,
      "Could not delete leave request.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}
