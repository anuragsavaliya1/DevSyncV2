/** Attendance correction requests: punch-in / punch-out / both. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/api-errors";
import {
  createAttendanceCorrectionRequest,
  createPunchOutCorrectionRequest,
  listMyPunchOutCorrectionRequests,
  listPendingPunchOutCorrectionRequests,
} from "@/lib/operations";
import { canManagePunchOutCorrections } from "@/lib/punch-out-correction-rules";
import { listResponseWithOptionalPaging } from "@/lib/pagination";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const createSchema = z
  .object({
    workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    correctionType: z
      .enum(["punch_out", "punch_in", "punch_in_and_out"])
      .optional()
      .default("punch_out"),
    requestedPunchInAt: z.string().datetime({ offset: true }).nullable().optional(),
    requestedPunchOutAt: z.string().datetime({ offset: true }).nullable().optional(),
    reason: z.string().min(1).max(2000),
  })
  .superRefine((value, ctx) => {
    if (value.correctionType === "punch_out" && !value.requestedPunchOutAt) {
      ctx.addIssue({
        code: "custom",
        message: "requestedPunchOutAt is required.",
        path: ["requestedPunchOutAt"],
      });
    }
    if (
      (value.correctionType === "punch_in" ||
        value.correctionType === "punch_in_and_out") &&
      !value.requestedPunchInAt
    ) {
      ctx.addIssue({
        code: "custom",
        message: "requestedPunchInAt is required.",
        path: ["requestedPunchInAt"],
      });
    }
    if (
      value.correctionType === "punch_in_and_out" &&
      !value.requestedPunchOutAt
    ) {
      ctx.addIssue({
        code: "custom",
        message: "requestedPunchOutAt is required.",
        path: ["requestedPunchOutAt"],
      });
    }
  });

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try {
    const workDate = request.nextUrl.searchParams.get("workDate") || undefined;
    const scope = request.nextUrl.searchParams.get("scope");
    const wantsOwn =
      scope === "mine" || !canManagePunchOutCorrections(user.role);

    if (wantsOwn) {
      let requests = await listMyPunchOutCorrectionRequests(user.id);
      if (workDate)
        requests = requests.filter((item) => item.workDate === workDate);
      return NextResponse.json(
        listResponseWithOptionalPaging(
          "requests",
          requests,
          request.nextUrl.searchParams,
        ),
      );
    }

    return NextResponse.json(
      listResponseWithOptionalPaging(
        "requests",
        await listPendingPunchOutCorrectionRequests(user, workDate),
        request.nextUrl.searchParams,
      ),
    );
  } catch (error) {
    const { error: message, status } = apiError(
      error,
      "Could not load attendance correction requests.",
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
    if (body.correctionType === "punch_out") {
      const correction = await createPunchOutCorrectionRequest(user, {
        workDate: body.workDate,
        requestedPunchOutAt: new Date(body.requestedPunchOutAt!),
        reason: body.reason,
      });
      return NextResponse.json({ request: correction });
    }

    const correction = await createAttendanceCorrectionRequest(user, {
      workDate: body.workDate,
      correctionType: body.correctionType,
      requestedPunchInAt: body.requestedPunchInAt
        ? new Date(body.requestedPunchInAt)
        : null,
      requestedPunchOutAt: body.requestedPunchOutAt
        ? new Date(body.requestedPunchOutAt)
        : null,
      reason: body.reason,
    });
    return NextResponse.json({ request: correction });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid attendance correction request." },
        { status: 400 },
      );
    }
    const { error: message, status } = apiError(
      error,
      "Could not submit attendance correction request.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}
