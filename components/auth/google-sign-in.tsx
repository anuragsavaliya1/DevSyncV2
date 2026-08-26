/** Client-side Google login button; the Firebase ID token is immediately exchanged for an HTTP-only DevSync session. */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Chrome, LoaderCircle } from "lucide-react";
import { signInWithPopup } from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/lib/firebase-client";

export function GoogleSignIn() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setIsSubmitting(true);
    setError(null);
    try {
      const credential = await signInWithPopup(firebaseAuth, googleProvider);
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken }),
      });
      if (!response.ok) throw new Error("Your Google account could not be approved for DevSync.");
      router.replace("/dashboard");
      router.refresh();
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Google sign-in failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={handleGoogleSignIn} disabled={isSubmitting} className="group flex w-full items-center justify-center gap-3 rounded-xl bg-[#173247] px-5 py-3.5 text-sm font-extrabold text-white transition duration-200 hover:bg-[#21445E] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70">
        {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Chrome className="h-4 w-4" />}
        {isSubmitting ? "Securing your session…" : "Continue with Google"}
        {!isSubmitting && <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />}
      </button>
      {error && <p role="alert" className="rounded-xl border border-[#F7C9C4] bg-[#FFF5F4] px-3 py-2.5 text-xs font-semibold leading-5 text-[#A4473D]">{error}</p>}
    </div>
  );
}
