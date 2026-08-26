/**
 * Quiet Command Center design system: route each visitor to the appropriate Firebase-backed entry point.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
