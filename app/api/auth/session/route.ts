/** Exchanges a verified Firebase ID token for a DevSync HTTP-only session cookie. */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createFirebaseSession } from "@/lib/firebase-admin";
import { DEV_SYNC_SESSION_COOKIE } from "@/lib/session";
import { upsertFirebaseUser } from "@/lib/users";

export const runtime = "nodejs";

const sessionSchema = z.object({ idToken: z.string().min(100) });
const sessionDurationMs = 1000 * 60 * 60 * 24 * 5;

export async function POST(request: NextRequest) {
  try {
    const { idToken } = sessionSchema.parse(await request.json());
    const { decodedToken, sessionCookie } = await createFirebaseSession(
      idToken,
      sessionDurationMs
    );
    const user = await upsertFirebaseUser(decodedToken);
    if (!user.isActive) throw new Error("This DevSync account is inactive.");

    const response = NextResponse.json({ user });
    response.cookies.set(DEV_SYNC_SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionDurationMs / 1000,
    });
    return response;
  } catch (error) {
    console.error(
      "[auth.session]",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Sign-in could not be verified." },
      { status: 401 }
    );
  }
}

export function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(DEV_SYNC_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
