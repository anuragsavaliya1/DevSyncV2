/**
 * User-initiated Firebase Google redirect flow. The redirect is intentionally
 * started from a visible button so browsers preserve the trusted user gesture.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Chrome, LoaderCircle } from "lucide-react";

type Phase = "ready" | "checking" | "redirecting" | "error";
const pendingKey = "devsync_google_redirect_pending";

async function getFirebaseGoogleClient() {
  const [{ getApp, getApps, initializeApp }, { getAuth, getRedirectResult, GoogleAuthProvider, signInWithRedirect }] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
  ]);
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) throw new Error("Firebase web configuration is missing from this browser build.");
  const app = getApps().length ? getApp() : initializeApp(config);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return { auth: getAuth(app), getRedirectResult, provider, signInWithRedirect };
}

export function GoogleSignIn() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function finishReturnedRedirect() {
      if (sessionStorage.getItem(pendingKey) !== "1") return;
      setPhase("checking");
      try {
        const { auth, getRedirectResult } = await getFirebaseGoogleClient();
        const credential = await Promise.race([
          getRedirectResult(auth),
          new Promise<null>((_, reject) => window.setTimeout(() => reject(new Error("Google did not return an identity result. Please start sign-in again.")), 12_000)),
        ]);
        sessionStorage.removeItem(pendingKey);
        if (!credential) throw new Error("Google did not return an identity result. Please start sign-in again.");
        const idToken = await credential.user.getIdToken();
        const response = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ idToken }) });
        if (!response.ok) throw new Error("Your Google account could not be approved for DevSync.");
        router.replace("/dashboard");
        router.refresh();
      } catch (loginError) {
        sessionStorage.removeItem(pendingKey);
        const firebaseCode = typeof loginError === "object" && loginError && "code" in loginError ? String(loginError.code) : null;
        if (active) { setError(firebaseCode ? `Google sign-in failed (${firebaseCode}).` : loginError instanceof Error ? loginError.message : "Google sign-in failed."); setPhase("error"); }
      }
    }
    void finishReturnedRedirect();
    return () => { active = false; };
  }, [router]);

  async function startGoogleSignIn() {
    setError(null);
    setPhase("redirecting");
    try {
      const { auth, provider, signInWithRedirect } = await getFirebaseGoogleClient();
      sessionStorage.setItem(pendingKey, "1");
      await signInWithRedirect(auth, provider);
    } catch (loginError) {
      sessionStorage.removeItem(pendingKey);
      const firebaseCode = typeof loginError === "object" && loginError && "code" in loginError ? String(loginError.code) : null;
      setError(firebaseCode ? `Google sign-in failed (${firebaseCode}).` : loginError instanceof Error ? loginError.message : "Google sign-in could not start.");
      setPhase("error");
    }
  }

  const isWorking = phase === "checking" || phase === "redirecting";
  const heading = phase === "checking" ? "Verifying your Google identity" : phase === "redirecting" ? "Opening Google sign-in" : phase === "error" ? "Google sign-in needs attention" : "Continue securely with Google";
  const detail = phase === "checking" ? "We are creating your protected DevSync session." : phase === "redirecting" ? "Your browser should now navigate to Google’s account chooser." : error || "Start Google sign-in from this secure browser page.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F8FB] p-5">
      <section className="w-full max-w-md rounded-[24px] border border-[#E4ECEF] bg-white p-8 text-center shadow-[0_20px_60px_rgba(25,55,75,0.09)]">
        {phase === "error" ? <AlertCircle className="mx-auto h-7 w-7 text-[#A4473D]" /> : <Chrome className="mx-auto h-7 w-7 text-[#0E9384]" />}
        <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#0E9384]">DevSync secure access</p>
        <h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.05em] text-[#173247]">{heading}</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[#718494]">{detail}</p>
        <button type="button" onClick={startGoogleSignIn} disabled={isWorking} className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#0E9384] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#087A6D] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-65">
          {isWorking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Chrome className="h-4 w-4" />}
          {isWorking ? "Connecting…" : "Start Google sign-in"}
          {!isWorking && <ArrowRight className="h-4 w-4" />}
        </button>
        <a href="/login" className="mt-4 inline-flex text-xs font-extrabold text-[#718494] hover:text-[#173247]">Back to DevSync login</a>
      </section>
    </main>
  );
}
