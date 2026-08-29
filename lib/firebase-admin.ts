/**
 * Server-only Firebase Admin initialization. Firebase verifies Google identity here;
 * MongoDB remains the source of truth for DevSync roles and all operational records.
 */
import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { parseFirebaseServiceAccount } from "@/lib/firebase-service-account";

function getFirebaseAdminApp() {
  if (getApps().length) return getApps()[0]!;

  const encodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!encodedServiceAccount) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured.");

  const serviceAccount = parseFirebaseServiceAccount(encodedServiceAccount);

  return initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
    }),
  });
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  return getAuth(getFirebaseAdminApp()).verifyIdToken(idToken, true);
}

export async function createFirebaseSession(idToken: string, expiresInMs: number) {
  const auth = getAuth(getFirebaseAdminApp());
  const decodedToken = await auth.verifyIdToken(idToken, true);
  const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: expiresInMs });
  return { decodedToken, sessionCookie };
}

export async function verifyFirebaseSession(sessionCookie: string): Promise<DecodedIdToken> {
  return getAuth(getFirebaseAdminApp()).verifySessionCookie(sessionCookie, true);
}

export async function deleteFirebaseUser(firebaseUid: string) {
  try {
    await getAuth(getFirebaseAdminApp()).deleteUser(firebaseUid);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "auth/user-not-found") return;
    throw error;
  }
}
