/** Leave requests: create own / manager apply-for-employee + list. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/api-errors";
import {
  createLeaveRequest,
  listLeaveRequestsForReviewers,
  listMyLeaveRequests,
} from "@/lib/operations";
import { canManageLeaveRequests } from "@/lib/leave-rules";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const createSchema = z.object({
  leaveType: z.enum(["casual", "sick", "other"]),
  dayPortion: z
    .enum([
      "full",
      "half",
      "first_half",
      "second_half",
      "hours_1",
      "hours_2",
      "hours_3",
    ])
    .optional()
    .default("full"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(1).max(2000),
  managerRemark: z.string().max(2000).optional(),
  userId: z.string().optional(),
  status: z.enum(["pending", "approved"]).optional(),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const scope = request.nextUrl.searchParams.get("scope");
    const statusParam = request.nextUrl.searchParams.get("status");
    const wantsOwn = scope === "mine" || !canManageLeaveRequests(user.role);

    if (wantsOwn) {
      return NextResponse.json({
        requests: await listMyLeaveRequests(user.id),
      });
    }

    const status =
      statusParam === "pending" ||
      statusParam === "approved" ||
      statusParam === "rejected" ||
      statusParam === "all"
        ? statusParam
        : "all";

    return NextResponse.json({
      requests: await listLeaveRequestsForReviewers(user, status),
    });
  } catch (error) {
    const { error: message, status } = apiError(
      error,
      "Could not load leave requests.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const body = createSchema.parse(await request.json());
    if (
      (body.userId || body.status) &&
      !canManageLeaveRequests(user.role)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const leaveRequest = await createLeaveRequest(user, {
      leaveType: body.leaveType,
      dayPortion: body.dayPortion,
      startDate: body.startDate,
      endDate: body.endDate,
      reason: body.reason,
      managerRemark: body.managerRemark,
      forUserId: body.userId,
      initialStatus: body.status,
    });
    return NextResponse.json({ request: leaveRequest });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid leave request." },
        { status: 400 },
      );
    }
    const { error: message, status } = apiError(
      error,
      "Could not submit leave request.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}
