/** Manager/Admin attendance summary for a selected employee (month range). */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/api-errors";
import { isValidMonthKey } from "@/lib/attendance-month";
import {
  canViewTeamData,
  getEmployeeAttendanceSummary,
} from "@/lib/operations";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .refine(isValidMonthKey, "Invalid month.");

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const viewer = await getCurrentUser();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!canViewTeamData(viewer)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { userId } = await context.params;
    const fromParam = request.nextUrl.searchParams.get("fromMonth");
    const toParam = request.nextUrl.searchParams.get("toMonth");
    const fromMonth = fromParam ? monthSchema.parse(fromParam) : undefined;
    const toMonth = toParam ? monthSchema.parse(toParam) : undefined;

    const summary = await getEmployeeAttendanceSummary(viewer, userId, {
      fromMonth,
      toMonth,
    });
    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid month range." }, { status: 400 });
    }
    const { error: message, status } = apiError(
      error,
      "Unable to load employee attendance summary.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}
