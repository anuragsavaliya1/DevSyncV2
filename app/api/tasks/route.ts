/** Assigned-task API for Manager/Admin assignment and authenticated task listing. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assignTask, canViewTeamData, listAssignedTasks } from "@/lib/operations";
import { requireCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const assignmentSchema = z.object({ developerUserId: z.string().min(1), description: z.string().min(3).max(2000) });

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const requestedUserId = request.nextUrl.searchParams.get("developerUserId") || user.id;
    if (requestedUserId !== user.id && !canViewTeamData(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const status = request.nextUrl.searchParams.get("status");
    if (status && status !== "pending" && status !== "completed") return NextResponse.json({ error: "Invalid task status" }, { status: 400 });
    return NextResponse.json({ tasks: await listAssignedTasks({ developerUserId: requestedUserId, status: status as "pending" | "completed" | undefined }) });
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const input = assignmentSchema.parse(await request.json());
    return NextResponse.json({ task: await assignTask(user, input) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Task could not be assigned.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
