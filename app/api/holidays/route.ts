/** Company holidays: list / create for Admin & Manager. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/api-errors";
import {
  createCompanyHoliday,
  listCompanyHolidays,
} from "@/lib/operations";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1).max(120),
  kind: z.enum(["holiday", "weekoff"]).default("holiday"),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  try {
    return NextResponse.json({
      holidays: await listCompanyHolidays(user),
    });
  } catch (error) {
    const { error: message, status } = apiError(
      error,
      "Could not load holidays.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  try {
    const body = createSchema.parse(await request.json());
    const holiday = await createCompanyHoliday(user, body);
    return NextResponse.json({ holiday });
  } catch (error) {
    const { error: message, status } = apiError(
      error,
      "Could not create holiday.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}
