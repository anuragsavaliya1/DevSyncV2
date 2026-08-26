/** Work-update API with attendance and date-window enforcement. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canViewTeamData, indiaDateKey, listWorkUpdates, saveWorkUpdate } from "@/lib/operations";
import { requireCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const updateSchema = z.object({
  updateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tasks: z.array(z.object({ id: z.string().min(1), description: z.string().min(1).max(2000), minutes: z.number().int().min(0).max(1440) })).min(1).max(50),
  blockers: z.string().max(4000).nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const search = request.nextUrl.searchParams;
    const requestedUserId = search.get("userId") || user.id;
    if (requestedUserId !== user.id && !canViewTeamData(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const updateDate = search.get("workDate") || undefined;
    return NextResponse.json({ updates: await listWorkUpdates({ userId: requestedUserId, updateDate }) });
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const input = updateSchema.parse(await request.json());
    const update = await saveWorkUpdate(user, input);
    return NextResponse.json({ update });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Work update could not be saved.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
