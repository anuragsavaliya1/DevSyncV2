/** Task-level comment endpoint for a task assignee, Manager, or Admin. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addTaskRemark } from "@/lib/operations";
import { requireCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
const remarkSchema = z.object({ text: z.string().min(1).max(2000) });

export async function POST(request: NextRequest, context: { params: Promise<{ taskId: string }> }) {
  try {
    const user = await requireCurrentUser();
    const { taskId } = await context.params;
    const { text } = remarkSchema.parse(await request.json());
    return NextResponse.json({ remark: await addTaskRemark(user, taskId, text) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Remark could not be saved." }, { status: 400 });
  }
}
