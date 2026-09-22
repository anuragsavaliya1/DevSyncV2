/** Work-update API with attendance and date-window enforcement. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  canViewTeamData,
  indiaDateKey,
  listWorkUpdates,
  saveWorkUpdate,
} from "@/lib/operations";
import {
  normalizeEmployeeHistoryFilter,
  type EmployeeHistoryRange,
} from "@/lib/employee-history-rules";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const rangeSchema = z.enum(["last_7_days", "this_month", "all_time"]);
const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const updateSchema = z.object({
  updateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tasks: z
    .array(
      z.object({
        id: z.string().min(1),
        description: z.string().min(1).max(2000),
        minutes: z.number().int().min(0).max(1440),
      })
    )
    .min(1)
    .max(50),
  blockers: z.string().max(4000).nullable(),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const search = request.nextUrl.searchParams;
    const requestedUserId = search.get("userId") || user.id;
    if (requestedUserId !== user.id && !canViewTeamData(user))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const updateDate = search.get("workDate") || undefined;
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
      updates: await listWorkUpdates({
        userId: requestedUserId,
        updateDate,
        fromDate,
        toDate,
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load work updates.";
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
    const input = updateSchema.parse(await request.json());
    const update = await saveWorkUpdate(user, input);
    return NextResponse.json({ update });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Work update could not be saved.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
