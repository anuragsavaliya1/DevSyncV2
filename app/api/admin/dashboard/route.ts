/** Admin/Manager dashboard aggregation for leave + attendance overview. */
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/api-errors";
import { isValidMonthKey } from "@/lib/attendance-month";
import { getAdminDashboard } from "@/lib/operations";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const monthParam = request.nextUrl.searchParams.get("month");
    const monthKey =
      monthParam && isValidMonthKey(monthParam) ? monthParam : undefined;
    const dashboard = await getAdminDashboard(user, { monthKey });
    return NextResponse.json(dashboard);
  } catch (error) {
    const { error: message, status } = apiError(
      error,
      "Could not load admin dashboard.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}
