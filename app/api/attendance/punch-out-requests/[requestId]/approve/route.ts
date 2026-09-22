/** Manager/Admin approval of a pending punch-out correction request. */
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/api-errors";
import { approvePunchOutCorrectionRequest } from "@/lib/operations";
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
    const result = await approvePunchOutCorrectionRequest(user, requestId);
    return NextResponse.json(result);
  } catch (error) {
    const { error: message, status } = apiError(
      error,
      "Could not approve punch-out correction.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}
