/** DevSync v2 MongoDB connection pool. This module is server-only and never imported by browser components. */
import "server-only";
import { Db, MongoClient } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var devsyncMongoClientPromise: Promise<MongoClient> | undefined;
}

function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured.");

  if (!global.devsyncMongoClientPromise) {
    global.devsyncMongoClientPromise = new MongoClient(uri).connect();
  }

  return global.devsyncMongoClientPromise;
}

export async function getMongoDatabase(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB_NAME || "devsync_v2");
}
