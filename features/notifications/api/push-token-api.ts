import { apiRequest } from "@/lib/api/api-client";

export async function registerPushToken(token: string) {
  return apiRequest<{ success: boolean }>("/api/notifications/push-token", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function unregisterPushToken(token: string) {
  return apiRequest<{ success: boolean }>("/api/notifications/push-token", {
    method: "DELETE",
    body: JSON.stringify({ token }),
  });
}
