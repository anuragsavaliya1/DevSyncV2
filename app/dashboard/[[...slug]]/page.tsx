/** Authenticated DevSync workspace backed entirely by Firebase-verified and MongoDB-persisted records. */
import { redirect } from "next/navigation";
import type { Route } from "next";
import { DevSyncWorkspace } from "@/features/workspace/components/devsync-workspace";
import {
  defaultWorkspaceTab,
  parseWorkspaceSlug,
  resolveWorkspaceLocation,
  workspacePath,
} from "@/constants/routes";
import { indiaDateKey } from "@/lib/operations";
import { serverNow } from "@/lib/server-clock";
import { requireCurrentUser } from "@/lib/auth/session";
import { getInitialAdminEmail } from "@/lib/users";

type DashboardPageProps = {
  params: Promise<{ slug?: string[] }>;
};

export default async function DashboardPage({ params }: DashboardPageProps) {
  const user = await requireCurrentUser();
  const { slug } = await params;
  const isBareDashboard = !slug?.length;
  const requested = isBareDashboard
    ? { tab: defaultWorkspaceTab(user.role), employeeId: null }
    : parseWorkspaceSlug(slug);
  const resolved = resolveWorkspaceLocation(requested, user.role);
  const expectedPath = workspacePath(resolved.tab, resolved.employeeId);
  const currentPath = slug?.length
    ? `/dashboard/${slug.join("/")}`
    : "/dashboard";

  if (currentPath !== expectedPath) {
    redirect(expectedPath as Route);
  }

  const businessDate = indiaDateKey(await serverNow());

  return (
    <DevSyncWorkspace
      businessDate={businessDate}
      initialAdminEmail={getInitialAdminEmail()}
      initialTab={resolved.tab}
      initialEmployeeId={resolved.employeeId}
      user={{
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        photoUrl: user.photoUrl,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        lastSignedInAt: user.lastSignedInAt.toISOString(),
      }}
    />
  );
}
