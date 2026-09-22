/** Assigned-task API for Manager/Admin assignment and authenticated task listing. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  assignTask,
  canViewTeamData,
  indiaDateKey,
  listAssignedTasks,
} from "@/lib/operations";
import {
  normalizeEmployeeHistoryFilter,
  type EmployeeHistoryRange,
} from "@/lib/employee-history-rules";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const rangeSchema = z.enum(["last_7_days", "this_month", "all_time"]);
const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const assignmentSchema = z.object({
  developerUserId: z.string().min(1),
  description: z.string().min(3).max(2000),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  dueTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const search = request.nextUrl.searchParams;
    const requestedUserId = search.get("developerUserId") || user.id;
    if (requestedUserId !== user.id && !canViewTeamData(user))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const status = search.get("status");
    if (status && status !== "pending" && status !== "completed")
      return NextResponse.json(
        { error: "Invalid task status" },
        { status: 400 }
      );

    const rangeParam = search.get("range");
    const fromDateParam = search.get("fromDate") || undefined;
    const toDateParam = search.get("toDate") || undefined;
    let fromDate = fromDateParam;
    let toDate = toDateParam;
    if (rangeParam) {
      const range = rangeSchema.parse(rangeParam) as EmployeeHistoryRange;
      const bounds = normalizeEmployeeHistoryFilter(
        { range, fromDate: fromDateParam, toDate: toDateParam },
        indiaDateKey(),
      );
      fromDate = bounds.fromDate;
      toDate = bounds.toDate;
    } else {
      if (fromDate) dateKeySchema.parse(fromDate);
      if (toDate) dateKeySchema.parse(toDate);
    }

    return NextResponse.json({
      tasks: await listAssignedTasks({
        developerUserId: requestedUserId,
        status: status as "pending" | "completed" | undefined,
        fromDate,
        toDate,
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load tasks.";
    if (message.startsWith("Invalid") || message.includes("cannot be after")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const input = assignmentSchema.parse(await request.json());
    return NextResponse.json({ task: await assignTask(user, input) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Task could not be assigned.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
