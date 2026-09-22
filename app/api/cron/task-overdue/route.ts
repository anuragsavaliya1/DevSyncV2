/**
 * Cron: notify assigners when pending assigned tasks are past due.
 * In-app Signal Center notification only — no email or browser push.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 * Schedule: vercel.json cron (every 15 minutes), or external scheduler.
 */
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/api-errors";
import { notifyOverdueAssignedTasks } from "@/lib/operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorizedCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await notifyOverdueAssignedTasks();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const { error: message, status } = apiError(
      error,
      "Could not send overdue task notifications.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
