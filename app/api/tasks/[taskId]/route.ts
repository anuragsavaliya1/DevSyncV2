/** Task completion and Admin-only deletion API. */
import { NextRequest, NextResponse } from "next/server";
import { completeTask, deleteAssignedTask } from "@/lib/operations";
import { apiError } from "@/lib/api-errors";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function PATCH(_: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const { taskId } = await context.params;
    return NextResponse.json({ task: await completeTask(user, taskId) });
  } catch (error) {
    const failure = apiError(error, "Task could not be updated.");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const { taskId } = await context.params;
    await deleteAssignedTask(user, taskId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const failure = apiError(error, "Task could not be deleted.");
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
