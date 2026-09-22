/** MongoDB user repository and role controls for DevSync v2. */
import "server-only";
import type { DecodedIdToken } from "firebase-admin/auth";
import { ObjectId } from "mongodb";
import { getMongoDatabase } from "@/lib/mongodb";
import { type Role, isRole } from "@/lib/roles";
import { initialRoleForVerifiedEmail } from "@/lib/provisioning";
import {
  userActivityChangeError,
  userPermanentDeleteError,
  userRoleChangeError,
} from "@/lib/user-lifecycle-rules";
import { deleteFirebaseUser } from "@/lib/firebase-admin";

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

type DevSyncUserDocument = Omit<DevSyncUser, "id"> & {
  _id: ObjectId;
  /** Browser FCM registration tokens for web push (optional). */
  fcmTokens?: string[];
};

let indexesPromise: Promise<void> | undefined;

async function ensureUserIndexes() {
  if (!indexesPromise) {
    indexesPromise = (async () => {
      const database = await getMongoDatabase();
      await Promise.all([
        database
          .collection<DevSyncUserDocument>("users")
          .createIndex({ firebaseUid: 1 }, { unique: true }),
        database
          .collection<DevSyncUserDocument>("users")
          .createIndex({ email: 1 }, { unique: true }),
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

export async function upsertFirebaseUser(
  identity: DecodedIdToken
): Promise<DevSyncUser> {
  if (!identity.email || identity.email_verified !== true)
    throw new Error("A verified Google email is required.");

  await ensureUserIndexes();
  const database = await getMongoDatabase();
  const users = database.collection<DevSyncUserDocument>("users");
  const now = new Date();
  const email = identity.email.toLowerCase();
  const isInitialAdmin =
    initialRoleForVerifiedEmail(email, getInitialAdminEmail()) === "admin";

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
    { upsert: true }
  );

  if (isInitialAdmin) {
    await users.updateOne(
      { firebaseUid: identity.uid },
      { $set: { role: "admin", updatedAt: now } }
    );
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

export async function getUserByFirebaseUid(
  firebaseUid: string
): Promise<DevSyncUser | null> {
  await ensureUserIndexes();
  const database = await getMongoDatabase();
  const user = await database
    .collection<DevSyncUserDocument>("users")
    .findOne({ firebaseUid });
  return user ? toPublicUser(user) : null;
}

export async function getUserById(userId: string): Promise<DevSyncUser | null> {
  if (!ObjectId.isValid(userId)) return null;
  await ensureUserIndexes();
  const database = await getMongoDatabase();
  const user = await database
    .collection<DevSyncUserDocument>("users")
    .findOne({ _id: new ObjectId(userId) });
  return user ? toPublicUser(user) : null;
}

export async function listUserFcmTokens(userId: string): Promise<string[]> {
  if (!ObjectId.isValid(userId)) return [];
  await ensureUserIndexes();
  const database = await getMongoDatabase();
  const user = await database
    .collection<DevSyncUserDocument>("users")
    .findOne(
      { _id: new ObjectId(userId) },
      { projection: { fcmTokens: 1 } },
    );
  return Array.isArray(user?.fcmTokens)
    ? [
        ...new Set(
          user.fcmTokens.filter(
            (token): token is string =>
              typeof token === "string" && token.trim().length > 0,
          ),
        ),
      ]
    : [];
}

export async function saveUserFcmToken(userId: string, token: string) {
  const trimmed = token.trim();
  if (!ObjectId.isValid(userId) || !trimmed) {
    throw new Error("Invalid push token.");
  }
  await ensureUserIndexes();
  const database = await getMongoDatabase();
  await database.collection<DevSyncUserDocument>("users").updateOne(
    { _id: new ObjectId(userId) },
    {
      $addToSet: { fcmTokens: trimmed },
      $set: { updatedAt: new Date() },
    },
  );
  return { saved: true as const };
}

export async function removeUserFcmToken(userId: string, token: string) {
  const trimmed = token.trim();
  if (!ObjectId.isValid(userId) || !trimmed) {
    throw new Error("Invalid push token.");
  }
  await ensureUserIndexes();
  const database = await getMongoDatabase();
  await database.collection<DevSyncUserDocument>("users").updateOne(
    { _id: new ObjectId(userId) },
    {
      $pull: { fcmTokens: trimmed },
      $set: { updatedAt: new Date() },
    },
  );
  return { removed: true as const };
}

export async function removeUserFcmTokens(userId: string, tokens: string[]) {
  const cleaned = tokens.map((token) => token.trim()).filter(Boolean);
  if (!ObjectId.isValid(userId) || !cleaned.length) return { removed: 0 };
  await ensureUserIndexes();
  const database = await getMongoDatabase();
  await database.collection<DevSyncUserDocument>("users").updateOne(
    { _id: new ObjectId(userId) },
    {
      $pull: { fcmTokens: { $in: cleaned } },
      $set: { updatedAt: new Date() },
    },
  );
  return { removed: cleaned.length };
}

export async function listUsers(): Promise<DevSyncUser[]> {
  await ensureUserIndexes();
  const database = await getMongoDatabase();
  const users = await database
    .collection<DevSyncUserDocument>("users")
    .find({})
    .sort({ createdAt: 1 })
    .toArray();
  return users.map(toPublicUser);
}

export async function changeUserRole(input: {
  actor: DevSyncUser;
  targetUserId: string;
  role: Role;
}): Promise<DevSyncUser> {
  if (input.actor.role !== "admin")
    throw new Error("Only an Admin can change roles.");
  if (!ObjectId.isValid(input.targetUserId))
    throw new Error("Invalid user ID.");
  if (!isRole(input.role)) throw new Error("Invalid role.");

  await ensureUserIndexes();
  const database = await getMongoDatabase();
  const users = database.collection<DevSyncUserDocument>("users");
  const targetId = new ObjectId(input.targetUserId);
  const target = await users.findOne({ _id: targetId });
  if (!target) throw new Error("User not found.");
  const activeAdminCount = await users.countDocuments({
    role: "admin",
    isActive: true,
  });
  const safeguard = userRoleChangeError({
    targetEmail: target.email,
    targetRole: target.role,
    targetIsActive: target.isActive,
    nextRole: input.role,
    initialAdminEmail: getInitialAdminEmail(),
    activeAdminCount,
  });
  if (safeguard) throw new Error(safeguard);

  const now = new Date();
  await users.updateOne(
    { _id: targetId },
    { $set: { role: input.role, updatedAt: now } }
  );
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

export async function changeUserActivity(input: {
  actor: DevSyncUser;
  targetUserId: string;
  isActive: boolean;
}): Promise<DevSyncUser> {
  if (input.actor.role !== "admin")
    throw new Error("Only an Admin can change employee access.");
  if (!ObjectId.isValid(input.targetUserId))
    throw new Error("Invalid user ID.");

  await ensureUserIndexes();
  const database = await getMongoDatabase();
  const users = database.collection<DevSyncUserDocument>("users");
  const targetId = new ObjectId(input.targetUserId);
  const target = await users.findOne({ _id: targetId });
  if (!target) throw new Error("User not found.");

  const activeAdminCount = await users.countDocuments({
    role: "admin",
    isActive: true,
  });
  const safeguard = userActivityChangeError({
    actorUserId: input.actor.id,
    targetUserId: input.targetUserId,
    targetEmail: target.email,
    nextIsActive: input.isActive,
    initialAdminEmail: getInitialAdminEmail(),
    targetRole: target.role,
    activeAdminCount,
  });
  if (safeguard) throw new Error(safeguard);

  const now = new Date();
  await users.updateOne(
    { _id: targetId },
    { $set: { isActive: input.isActive, updatedAt: now } }
  );
  await database.collection("auditEvents").insertOne({
    actorFirebaseUid: input.actor.firebaseUid,
    targetUserId: targetId,
    action: input.isActive ? "user.reactivated" : "user.deactivated",
    metadata: {
      previousIsActive: target.isActive,
      nextIsActive: input.isActive,
    },
    createdAt: now,
  });

  const updated = await users.findOne({ _id: targetId });
  if (!updated) throw new Error("Employee access could not be updated.");
  return toPublicUser(updated);
}

/** Permanently removes an employee account and every operational record owned by or attributed to it. */
export async function permanentlyDeleteUser(input: {
  actor: DevSyncUser;
  targetUserId: string;
}): Promise<void> {
  if (input.actor.role !== "admin")
    throw new Error("Only an Admin can permanently delete employees.");
  if (!ObjectId.isValid(input.targetUserId))
    throw new Error("Invalid user ID.");

  await ensureUserIndexes();
  const database = await getMongoDatabase();
  const users = database.collection<DevSyncUserDocument>("users");
  const targetId = new ObjectId(input.targetUserId);
  const target = await users.findOne({ _id: targetId });
  if (!target) throw new Error("User not found.");
  const safeguard = userPermanentDeleteError({
    actorUserId: input.actor.id,
    targetUserId: input.targetUserId,
    targetEmail: target.email,
    targetRole: target.role,
    initialAdminEmail: getInitialAdminEmail(),
  });
  if (safeguard) throw new Error(safeguard);

  // Remove the Firebase identity first. If this fails, MongoDB records stay intact and the operation can be retried safely.
  await deleteFirebaseUser(target.firebaseUid);

  const taskCollection = database.collection<{
    developerUserId: ObjectId;
    assignedByUserId: ObjectId;
    remarks: { userId: string }[];
  }>("assignedTasks");
  const ownedTaskIds = (
    await taskCollection
      .find(
        {
          $or: [{ developerUserId: targetId }, { assignedByUserId: targetId }],
        },
        { projection: { _id: 1 } }
      )
      .toArray()
  ).map(task => task._id);
  const now = new Date();

  await Promise.all([
    database.collection("attendance").deleteMany({ userId: targetId }),
    database.collection("workUpdates").deleteMany({ userId: targetId }),
    taskCollection.deleteMany({
      $or: [{ developerUserId: targetId }, { assignedByUserId: targetId }],
    }),
    taskCollection.updateMany(
      { "remarks.userId": input.targetUserId },
      {
        $pull: { remarks: { userId: input.targetUserId } },
        $set: { updatedAt: now },
      }
    ),
    database
      .collection("notifications")
      .deleteMany({
        $or: [
          { recipientUserId: targetId },
          { "resource.id": { $in: ownedTaskIds } },
        ],
      }),
    database
      .collection("auditEvents")
      .deleteMany({
        $or: [
          { targetUserId: targetId },
          { actorFirebaseUid: target.firebaseUid },
        ],
      }),
  ]);

  await users.deleteOne({ _id: targetId });
}
