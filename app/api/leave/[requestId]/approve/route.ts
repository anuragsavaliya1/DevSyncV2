/** Manager/Admin approval of a pending leave request. */
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/api-errors";
import { approveLeaveRequest } from "@/lib/operations";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const { requestId } = await context.params;
    const leaveRequest = await approveLeaveRequest(user, requestId);
    return NextResponse.json({ request: leaveRequest });
  } catch (error) {
    const { error: message, status } = apiError(
      error,
      "Could not approve leave request.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}
