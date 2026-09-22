/** Delete a company holiday (Admin / Manager). */
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/api-errors";
import { deleteCompanyHoliday } from "@/lib/operations";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ holidayId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  try {
    const { holidayId } = await context.params;
    const result = await deleteCompanyHoliday(user, holidayId);
    return NextResponse.json(result);
  } catch (error) {
    const { error: message, status } = apiError(
      error,
      "Could not delete holiday.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}
