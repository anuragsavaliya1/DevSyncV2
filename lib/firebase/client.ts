/**
 * Browser-only Firebase client. This configuration identifies the Firebase web app;
 * it is not a privileged credential and never grants direct MongoDB access.
 */
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseClientConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export function isFirebaseMessagingConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() &&
      process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim(),
  );
}