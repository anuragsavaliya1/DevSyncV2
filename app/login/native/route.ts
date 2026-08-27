/**
 * Framework-independent Firebase auth page. It uses the official browser ESM
 * modules directly so Google sign-in remains available if a preview blocks React
 * event hydration. It still exchanges the ID token only with DevSync’s server.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const showDiagnosticError = process.env.NODE_ENV !== "production" && new URL(request.url).searchParams.get("devAuthTest") === "error";
  const config = JSON.stringify({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }).replace(/</g, "\\u003c");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DevSync secure access</title>
<style>body{margin:0;background:#f6f8fb;color:#173247;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh}.card{width:min(420px,calc(100vw - 40px));box-sizing:border-box;padding:38px;border:1px solid #e4ecef;border-radius:24px;background:#fff;text-align:center;box-shadow:0 20px 60px rgba(25,55,75,.09)}.eyebrow{color:#0e9384;font-size:10px;font-weight:800;letter-spacing:.15em;text-transform:uppercase}h1{margin:10px 0 12px;font-size:27px;letter-spacing:-.05em}p{color:#718494;font-size:14px;line-height:1.6}button{width:100%;margin-top:20px;border:0;border-radius:12px;padding:14px 16px;background:#0e9384;color:#fff;font-size:14px;font-weight:800;cursor:pointer}button:disabled{opacity:.65;cursor:wait}.error{display:none;margin-top:16px;padding:12px;border:1px solid #f7c9c4;border-radius:12px;background:#fff5f4;color:#a4473d;font-size:12px;font-weight:700;text-align:left}.back{display:inline-block;margin-top:18px;color:#718494;font-size:12px;font-weight:700;text-decoration:none}</style></head>
<body><section class="card"><div class="eyebrow">DevSync secure access</div><h1>Continue with Google</h1><p id="status">Start Google sign-in from this secure browser page.</p><button id="start">Start Google sign-in</button><div id="error" class="error"></div><a class="back" href="/login">Back to DevSync login</a></section>
<script type="module">
  import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
  import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
  const config = ${config};
  const status = document.getElementById("status"), button = document.getElementById("start"), error = document.getElementById("error");
  const showError = (message) => { error.textContent = message; error.style.display = "block"; status.textContent = "Google sign-in needs attention."; button.disabled = false; button.textContent = "Try Google sign-in again"; };
  try {
    if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) throw new Error("Firebase web configuration is missing.");
    const app = getApps().length ? getApp() : initializeApp(config); const auth = getAuth(app); const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: "select_account" });
    button.addEventListener("click", async () => { button.disabled = true; button.textContent = "Opening Google…"; error.style.display = "none"; try { const result = await signInWithPopup(auth, provider); status.textContent = "Creating your protected DevSync session…"; const response = await fetch("/api/auth/session", { method:"POST", headers:{"Content-Type":"application/json"}, credentials:"include", body:JSON.stringify({idToken:await result.user.getIdToken()}) }); if (!response.ok) throw new Error("Your Google account could not be approved for DevSync."); location.replace("/dashboard"); } catch (e) { showError(e && e.code ? "Google sign-in failed (" + e.code + ")." : e.message || "Google sign-in could not start."); } });
    ${showDiagnosticError ? 'showError("Google sign-in failed (dev/controlled-failure).");' : ""}
  } catch (e) { showError(e && e.code ? "Google sign-in failed (" + e.code + ")." : e.message || "Google sign-in could not start."); }
</script></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
