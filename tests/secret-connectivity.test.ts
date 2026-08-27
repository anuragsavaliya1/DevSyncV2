/**
 * Credential validation for DevSync v2. The test only makes lightweight authenticated
 * calls; it never prints connection strings, service-account data, or user records.
 */
import { cert, deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { MongoClient } from "mongodb";
import { afterAll, describe, expect, it } from "vitest";
import { parseFirebaseServiceAccount } from "../lib/firebase-service-account";

const mongoUri = process.env.MONGODB_URI;
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const mongoClient = mongoUri ? new MongoClient(mongoUri, { serverSelectionTimeoutMS: 10_000 }) : null;

afterAll(async () => {
  await mongoClient?.close();
});

describe("configured DevSync external credentials", () => {
  it("connects to the supplied MongoDB Atlas database", async () => {
    expect(mongoUri).toBeTruthy();
    const database = mongoClient!.db(process.env.MONGODB_DB_NAME || "devsync_v2");
    const result = await database.command({ ping: 1 });
    expect(result.ok).toBe(1);
  }, 20_000);

  it("persists the Firebase-authenticated initial Admin with the Admin role", async () => {
    const database = mongoClient!.db(process.env.MONGODB_DB_NAME || "devsync_v2");
    const user = await database.collection("users").findOne({ email: "anurag.xitijinfo@gmail.com" }, { projection: { email: 1, role: 1, firebaseUid: 1, isActive: 1 } });
    expect(user).toBeTruthy();
    expect(user).toMatchObject({ email: "anurag.xitijinfo@gmail.com", role: "admin", isActive: true });
    expect(typeof user?.firebaseUid).toBe("string");
  }, 20_000);

  it("authenticates to Firebase Admin without exposing credential data", async () => {
    expect(serviceAccountJson).toBeTruthy();
    const serviceAccount = parseFirebaseServiceAccount(serviceAccountJson!);
    const app = initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
      }),
    }, `credential-check-${Date.now()}`);

    try {
      const result = await getAuth(app).listUsers(1);
      expect(Array.isArray(result.users)).toBe(true);
    } finally {
      await deleteApp(app);
    }
  }, 20_000);
});
