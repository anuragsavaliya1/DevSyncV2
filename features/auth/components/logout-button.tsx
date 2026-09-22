/** Client-side logout action that removes the server-issued DevSync session cookie. */
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, LogOut, X } from "lucide-react";
import { useLogout } from "@/features/auth/hooks/use-logout";

export function LogoutButton() {
  const logout = useLogout();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  useEffect(() => {
    if (!isConfirmOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !logout.isPending) {
        setIsConfirmOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isConfirmOpen, logout.isPending]);

  function closeConfirm() {
    if (logout.isPending) return;
    setIsConfirmOpen(false);
  }

  function confirmLogout() {
    logout.mutate(undefined, {
      onError: () => {
        // Keep dialog open so the user can retry or cancel.
      },
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsConfirmOpen(true)}
        disabled={logout.isPending}
        aria-label="Sign out"
        className="inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-[#617687] transition hover:bg-[#eef4f5] hover:text-[#102a3a] sm:px-3"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Sign out</span>
      </button>

      {isConfirmOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-end justify-center bg-[#102a3a]/35 p-3 sm:items-center"
              role="presentation"
              onClick={logout.isPending ? undefined : closeConfirm}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="logout-confirm-title"
                aria-describedby="logout-confirm-description"
                className="w-full max-w-md rounded-2xl border border-[#E5EDF0] bg-white p-5 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">
                      Confirm sign out
                    </p>
                    <h3
                      id="logout-confirm-title"
                      className="mt-1 text-lg font-extrabold text-[#173247]"
                    >
                      Sign out of DevSync?
                    </h3>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    disabled={logout.isPending}
                    onClick={closeConfirm}
                    className="rounded-lg p-1.5 text-[#8294A0] hover:bg-[#F4F7F9] disabled:opacity-60"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p
                  id="logout-confirm-description"
                  className="mt-3 text-sm font-medium leading-6 text-[#6A8191]"
                >
                  You will leave this workspace and need to sign in again with
                  your approved Google account to continue.
                </p>
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={logout.isPending}
                    onClick={closeConfirm}
                    className="rounded-xl border border-[#DDE7EB] px-4 py-2.5 text-xs font-extrabold text-[#5F7482] hover:bg-[#F7FAFB] disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={logout.isPending}
                    onClick={confirmLogout}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#102a3a] px-4 py-2.5 text-xs font-extrabold text-white hover:bg-[#173247] disabled:opacity-60"
                  >
                    {logout.isPending ? (
                      <>
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        Signing out…
                      </>
                    ) : (
                      <>
                        <LogOut className="h-3.5 w-3.5" />
                        Sign out
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
