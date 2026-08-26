/** Authenticated DevSync workspace backed entirely by Firebase-verified and MongoDB-persisted records. */
import { DevSyncWorkspace } from "@/components/workspace/devsync-workspace";
import { indiaDateKey } from "@/lib/operations";
import { requireCurrentUser } from "@/lib/session";

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  return <DevSyncWorkspace businessDate={indiaDateKey()} user={{ id: user.id, email: user.email, displayName: user.displayName, photoUrl: user.photoUrl, role: user.role, isActive: user.isActive, createdAt: user.createdAt.toISOString(), lastSignedInAt: user.lastSignedInAt.toISOString() }} />;
}
