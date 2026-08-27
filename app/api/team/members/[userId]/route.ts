/** Manager/Admin selected-employee operational review endpoint with bounded history filters. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeEmployeeHistoryFilter } from "@/lib/employee-history-rules";
import { apiError } from "@/lib/api-errors";
import { canViewTeamData, indiaDateKey, listAssignedTasks, listWorkUpdates } from "@/lib/operations";
import { getCurrentUser } from "@/lib/session";
import { getUserById } from "@/lib/users";

export const runtime = "nodejs";

const querySchema = z.object({
  range: z.enum(["last_7_days", "this_month", "all_time"]).default("last_7_days"),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  query: z.string().max(120).optional(),
});

export async function GET(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canViewTeamData(viewer)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { userId } = await context.params;
    const employee = await getUserById(userId);
    if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

    const parsed = querySchema.parse({
      range: request.nextUrl.searchParams.get("range") || undefined,
      fromDate: request.nextUrl.searchParams.get("fromDate") || undefined,
      toDate: request.nextUrl.searchParams.get("toDate") || undefined,
      query: request.nextUrl.searchParams.get("query") || undefined,
    });
    const filter = normalizeEmployeeHistoryFilter(parsed, indiaDateKey());
    const [updates, pendingTasks, completedTasks] = await Promise.all([
      listWorkUpdates({ userId, ...filter }),
      listAssignedTasks({ developerUserId: userId, status: "pending" }),
      listAssignedTasks({ developerUserId: userId, status: "completed" }),
    ]);
    return NextResponse.json({
      employee,
      updates,
      tasks: { pending: pendingTasks, completed: completedTasks },
      summary: { totalUpdates: updates.length, totalMinutes: updates.reduce((total, update) => total + update.totalMinutes, 0), pendingTasks: pendingTasks.length },
    });
  } catch (error) {
    const failure = apiError(error, "Unable to load employee details.");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
