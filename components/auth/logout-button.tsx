/** Client-side logout action that removes the server-issued DevSync session cookie. */
"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE", credentials: "include" });
    router.replace("/login");
    router.refresh();
  }
  return <button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-extrabold text-[#657B8C] transition hover:bg-[#EEF4F5] hover:text-[#173247]"><LogOut className="h-3.5 w-3.5" />Sign out</button>;
}
