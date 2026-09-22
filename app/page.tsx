/** Quiet Command Center: route each visitor to the appropriate Firebase-backed entry point. */
import { redirect } from "next/navigation";
import type { Route } from "next";
import { defaultWorkspaceTab, routes, workspacePath } from "@/constants/routes";
import { getCurrentUser } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(routes.login as Route);
  }
  redirect(workspacePath(defaultWorkspaceTab(user.role)) as Route);
}
