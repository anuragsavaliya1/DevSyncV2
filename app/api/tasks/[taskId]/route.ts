/** Task completion and Admin-only deletion API. */
import { NextRequest, NextResponse } from "next/server";
import { completeTask, deleteAssignedTask } from "@/lib/operations";
import { requireCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function PATCH(_: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  try {
    const user = await requireCurrentUser();
    const { taskId } = await context.params;
    return NextResponse.json({ task: await completeTask(user, taskId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Task could not be updated." }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  try {
    const user = await requireCurrentUser();
    const { taskId } = await context.params;
    await deleteAssignedTask(user, taskId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Task could not be deleted." }, { status: 400 });
  }
}
