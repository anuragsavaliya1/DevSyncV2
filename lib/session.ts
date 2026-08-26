/** Server-side Firebase session helpers used by protected Next.js routes and pages. */
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyFirebaseSession } from "@/lib/firebase-admin";
import { getUserByFirebaseUid, type DevSyncUser } from "@/lib/users";

export const DEV_SYNC_SESSION_COOKIE = "devsync_session";

export async function getCurrentUser(): Promise<DevSyncUser | null> {
  const sessionCookie = (await cookies()).get(DEV_SYNC_SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await verifyFirebaseSession(sessionCookie);
    const user = await getUserByFirebaseUid(decoded.uid);
    return user?.isActive ? user : null;
  } catch {
    return null;
  }
}

export async function requireCurrentUser(): Promise<DevSyncUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<DevSyncUser> {
  const user = await requireCurrentUser();
  if (user.role !== "admin") throw new Error("Forbidden");
  return user;
}
