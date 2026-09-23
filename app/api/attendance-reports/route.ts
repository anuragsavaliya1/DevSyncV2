/** Monthly Attendance Report for Manager/Admin — aggregation over attendance + leave. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/api-errors";
import { isValidMonthKey } from "@/lib/attendance-month";
import { ATTENDANCE_REPORT_ACTIONS } from "@/lib/attendance-report-rules";
import {
  createAttendanceReportManualEntry,
  deleteAttendanceReportEntry,
  getMonthlyAttendanceReport,
  updateAttendanceReportEntry,
} from "@/lib/operations";
import { listResponseWithOptionalPaging } from "@/lib/pagination";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const actionSchema = z.enum(ATTENDANCE_REPORT_ACTIONS);

const createSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employeeId: z.string().min(1),
  action: actionSchema,
  details: z.string().min(1).max(2000),
  managerRemark: z.string().max(2000).optional(),
});

const updateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  id: z.string().min(1),
  action: actionSchema.optional(),
  details: z.string().min(1).max(2000).optional(),
  managerRemark: z.string().max(2000).optional(),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const params = request.nextUrl.searchParams;
    const monthParam = params.get("month");
    const fromParam = params.get("fromMonth");
    const toParam = params.get("toMonth");
    const employeeId = params.get("employeeId");

    const report = await getMonthlyAttendanceReport(user, {
      month:
        monthParam && isValidMonthKey(monthParam) ? monthParam : undefined,
      fromMonth:
        fromParam && isValidMonthKey(fromParam) ? fromParam : undefined,
      toMonth: toParam && isValidMonthKey(toParam) ? toParam : undefined,
      employeeId: employeeId?.trim() || undefined,
    });
    const actionFilter = params.get("action")?.trim() || null;
    let entries = report.entries;
    if (
      actionFilter &&
      actionFilter !== "all" &&
      (ATTENDANCE_REPORT_ACTIONS as readonly string[]).includes(actionFilter)
    ) {
      entries = entries.filter((entry) => entry.action === actionFilter);
    }
    const hasPaging = params.has("start") || params.has("limit");
    if (!hasPaging) {
      return NextResponse.json({
        ...report,
        entries,
      });
    }
    const entriesPage = listResponseWithOptionalPaging(
      "entries",
      entries,
      params,
    );
    return NextResponse.json({
      ...report,
      ...entriesPage,
    });
  } catch (error) {
    const { error: message, status } = apiError(
      error,
      "Unable to generate attendance report. Please try again.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = createSchema.parse(await request.json());
    const report = await createAttendanceReportManualEntry(user, body);
    return NextResponse.json(report);
  } catch (error) {
    const { error: message, status } = apiError(
      error,
      "Could not add report entry.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = updateSchema.parse(await request.json());
    const report = await updateAttendanceReportEntry(user, body);
    return NextResponse.json(report);
  } catch (error) {
    const { error: message, status } = apiError(
      error,
      "Could not update report entry.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (user.role !== "admin" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const month = request.nextUrl.searchParams.get("month");
    const id = request.nextUrl.searchParams.get("id");
    if (!month || !isValidMonthKey(month) || !id) {
      return NextResponse.json(
        { error: "month and id are required." },
        { status: 400 },
      );
    }
    const report = await deleteAttendanceReportEntry(user, { month, id });
    return NextResponse.json(report);
  } catch (error) {
    const { error: message, status } = apiError(
      error,
      "Could not delete report entry.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}
