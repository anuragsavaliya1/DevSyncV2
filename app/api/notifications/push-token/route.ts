/** Register / unregister browser FCM push tokens for the signed-in user. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/api-errors";
import { getCurrentUser } from "@/lib/session";
import { removeUserFcmToken, saveUserFcmToken } from "@/lib/users";

export const runtime = "nodejs";

const tokenSchema = z.object({
  token: z.string().min(20).max(4096),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const body = tokenSchema.parse(await request.json());
    await saveUserFcmToken(user.id, body.token);
    return NextResponse.json({ success: true });
  } catch (error) {
    const { error: message, status } = apiError(
      error,
      "Could not save push token.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const body = tokenSchema.parse(await request.json().catch(() => ({})));
    await removeUserFcmToken(user.id, body.token);
    return NextResponse.json({ success: true });
  } catch (error) {
    const { error: message, status } = apiError(
      error,
      "Could not remove push token.",
    );
    return NextResponse.json({ error: message }, { status });
  }
}
