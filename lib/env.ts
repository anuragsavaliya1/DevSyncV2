/** Server-only Firebase Admin and MongoDB environment parsing for DevSync v2. */
import { z } from "zod";

const serverEnvironment = z.object({
  MONGODB_URI: z.string().url(),
  MONGODB_DB_NAME: z.string().min(1).default("devsync_v2"),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().min(1),
  INITIAL_ADMIN_EMAIL: z.string().email().transform((email) => email.toLowerCase()),
});

export type ServerEnvironment = z.infer<typeof serverEnvironment>;

export function getServerEnvironment(): ServerEnvironment {
  return serverEnvironment.parse({
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB_NAME: process.env.MONGODB_DB_NAME,
    FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    INITIAL_ADMIN_EMAIL: process.env.INITIAL_ADMIN_EMAIL,
  });
}
