/**
 * Trusted wall clock for official DevSync timestamps.
 *
 * Browser / OS clock must never define punch times, attendance creation,
 * work-update submission, task completion, or notification creation.
 * Live UI clocks and countdowns may still use the browser for display only.
 *
 * Prefer MongoDB's server time (NTP-synced on Atlas) so changing a laptop's
 * system clock cannot fake official attendance records during local `next dev`.
 */
import "server-only";
import { getMongoDatabase } from "@/lib/db/mongodb";

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

/** Current instant from MongoDB (or host clock only if Mongo time is unavailable). */
export async function serverNow(): Promise<Date> {
  try {
    const database = await getMongoDatabase();
    const hello = await database.command({ hello: 1 });
    const fromHello = asDate(hello.localTime);
    if (fromHello) return fromHello;
  } catch {
    // Fall through — request already needs Mongo for writes; host clock is last resort.
  }
  return new Date();
}
