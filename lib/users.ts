/** MongoDB user repository and role controls for DevSync v2. */
import "server-only";
import type { DecodedIdToken } from "firebase-admin/auth";
import { ObjectId } from "mongodb";
import { getMongoDatabase } from "@/lib/mongodb";
import { type Role, isRole } from "@/lib/roles";
import { initialRoleForVerifiedEmail } from "@/lib/provisioning";
import { userActivityChangeError } from "@/lib/user-lifecycle-rules";

export type DevSyncUser = {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSignedInAt: Date;
};

type DevSyncUserDocument = Omit<DevSyncUser, "id"> & { _id: ObjectId };

let indexesPromise: Promise<void> | undefined;

async function ensureUserIndexes() {
  if (!indexesPromise) {
    indexesPromise = (async () => {
      const database = await getMongoDatabase();
      await Promise.all([
        database.collection<DevSyncUserDocument>("users").createIndex({ firebaseUid: 1 }, { unique: true }),
        database.collection<DevSyncUserDocument>("users").createIndex({ email: 1 }, { unique: true }),
        database.collection("auditEvents").createIndex({ createdAt: -1 }),
      ]);
    })();
  }
  await indexesPromise;
}

function toPublicUser(document: DevSyncUserDocument): DevSyncUser {
  return {
    id: document._id.toHexString(),
    firebaseUid: document.firebaseUid,
    email: document.email,
    displayName: document.displayName,
    photoUrl: document.photoUrl,
    role: document.role,
    isActive: document.isActive,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    lastSignedInAt: document.lastSignedInAt,
  };
}

export function getInitialAdminEmail() {
  const email = process.env.INITIAL_ADMIN_EMAIL;
  if (!email) throw new Error("INITIAL_ADMIN_EMAIL is not configured.");
  return email.trim().toLowerCase();
}

export async function upsertFirebaseUser(identity: DecodedIdToken): Promise<DevSyncUser> {
  if (!identity.email || identity.email_verified !== true) throw new Error("A verified Google email is required.");

  await ensureUserIndexes();
  const database = await getMongoDatabase();
  const users = database.collection<DevSyncUserDocument>("users");
  const now = new Date();
  const email = identity.email.toLowerCase();
  const isInitialAdmin = initialRoleForVerifiedEmail(email, getInitialAdminEmail()) === "admin";

  const update = await users.updateOne(
    { firebaseUid: identity.uid },
    {
      $set: {
        email,
        displayName: identity.name ?? null,
        photoUrl: identity.picture ?? null,
        updatedAt: now,
        lastSignedInAt: now,
      },
      $setOnInsert: {
        firebaseUid: identity.uid,
        role: isInitialAdmin ? "admin" : "developer",
        isActive: true,
        createdAt: now,
      },
    },
    { upsert: true },
  );

  if (isInitialAdmin) {
    await users.updateOne({ firebaseUid: identity.uid }, { $set: { role: "admin", updatedAt: now } });
  }

  const user = await users.findOne({ firebaseUid: identity.uid });
  if (!user) throw new Error("DevSync user could not be created.");

  if (update.upsertedId) {
    await database.collection("auditEvents").insertOne({
      actorFirebaseUid: identity.uid,
      targetUserId: user._id,
      action: "user.created",
      metadata: { assignedRole: user.role },
      createdAt: now,
    });
  }

  return toPublicUser(user);
}

export async function getUserByFirebaseUid(firebaseUid: string): Promise<DevSyncUser | null> {
  await ensureUserIndexes();
  const database = await getMongoDatabase();
  const user = await database.collection<DevSyncUserDocument>("users").findOne({ firebaseUid });
  return user ? toPublicUser(user) : null;
}

export async function getUserById(userId: string): Promise<DevSyncUser | null> {
  if (!ObjectId.isValid(userId)) return null;
  await ensureUserIndexes();
  const database = await getMongoDatabase();
  const user = await database.collection<DevSyncUserDocument>("users").findOne({ _id: new ObjectId(userId) });
  return user ? toPublicUser(user) : null;
}

export async function listUsers(): Promise<DevSyncUser[]> {
  await ensureUserIndexes();
  const database = await getMongoDatabase();
  const users = await database.collection<DevSyncUserDocument>("users").find({}).sort({ createdAt: 1 }).toArray();
  return users.map(toPublicUser);
}

export async function changeUserRole(input: { actor: DevSyncUser; targetUserId: string; role: Role }): Promise<DevSyncUser> {
  if (input.actor.role !== "admin") throw new Error("Only an Admin can change roles.");
  if (!ObjectId.isValid(input.targetUserId)) throw new Error("Invalid user ID.");
  if (!isRole(input.role)) throw new Error("Invalid role.");

  await ensureUserIndexes();
  const database = await getMongoDatabase();
  const users = database.collection<DevSyncUserDocument>("users");
  const targetId = new ObjectId(input.targetUserId);
  const target = await users.findOne({ _id: targetId });
  if (!target) throw new Error("User not found.");
  if (target.email === getInitialAdminEmail() && input.role !== "admin") throw new Error("The initial Admin cannot be demoted through this endpoint.");

  const now = new Date();
  await users.updateOne({ _id: targetId }, { $set: { role: input.role, updatedAt: now } });
  await database.collection("auditEvents").insertOne({
    actorFirebaseUid: input.actor.firebaseUid,
    targetUserId: targetId,
    action: "user.role_changed",
    metadata: { previousRole: target.role, nextRole: input.role },
    createdAt: now,
  });

  const updated = await users.findOne({ _id: targetId });
  if (!updated) throw new Error("User role could not be updated.");
  return toPublicUser(updated);
}

export async function changeUserActivity(input: { actor: DevSyncUser; targetUserId: string; isActive: boolean }): Promise<DevSyncUser> {
  if (input.actor.role !== "admin") throw new Error("Only an Admin can change employee access.");
  if (!ObjectId.isValid(input.targetUserId)) throw new Error("Invalid user ID.");

  await ensureUserIndexes();
  const database = await getMongoDatabase();
  const users = database.collection<DevSyncUserDocument>("users");
  const targetId = new ObjectId(input.targetUserId);
  const target = await users.findOne({ _id: targetId });
  if (!target) throw new Error("User not found.");

  const safeguard = userActivityChangeError({
    actorUserId: input.actor.id,
    targetUserId: input.targetUserId,
    targetEmail: target.email,
    nextIsActive: input.isActive,
    initialAdminEmail: getInitialAdminEmail(),
  });
  if (safeguard) throw new Error(safeguard);

  const now = new Date();
  await users.updateOne({ _id: targetId }, { $set: { isActive: input.isActive, updatedAt: now } });
  await database.collection("auditEvents").insertOne({
    actorFirebaseUid: input.actor.firebaseUid,
    targetUserId: targetId,
    action: input.isActive ? "user.reactivated" : "user.deactivated",
    metadata: { previousIsActive: target.isActive, nextIsActive: input.isActive },
    createdAt: now,
  });

  const updated = await users.findOne({ _id: targetId });
  if (!updated) throw new Error("Employee access could not be updated.");
  return toPublicUser(updated);
}
