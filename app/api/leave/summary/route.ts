/** Manager/Admin leave status card counts (pending / approved / rejected). */
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/api-errors";
import { canManageLeaveRequests } from "@/lib/leave-rules";
import { getLeaveStatusSummaryForReviewers } from "@/lib/operations";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!canManageLeaveRequests(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const summary = await getLeaveStatusSummaryForReviewers(user);
    return NextResponse.json({ summary });
  } catch (error) {
    const { error: message, status } = apiError(
      error,
      "Could not load leave status summary.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}
