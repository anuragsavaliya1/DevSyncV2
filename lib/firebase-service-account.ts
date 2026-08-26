/** Parses a Firebase Admin service account supplied as compact JSON or base64-encoded JSON. */
export type FirebaseServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

export function parseFirebaseServiceAccount(rawValue: string): FirebaseServiceAccount {
  const value = rawValue.trim();
  const parsed = tryParseJson(value) ?? tryParseJson(Buffer.from(value, "base64").toString("utf8"));

  if (!parsed || typeof parsed.project_id !== "string" || typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain a Firebase Admin service-account JSON object.");
  }

  return parsed;
}

function tryParseJson(value: string): FirebaseServiceAccount | null {
  try {
    return JSON.parse(value) as FirebaseServiceAccount;
  } catch {
    return null;
  }
}
