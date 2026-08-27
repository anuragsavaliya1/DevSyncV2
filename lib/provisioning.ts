/** Pure user-provisioning rules shared by server code and unit tests. */
import type { Role } from "@/lib/roles";

export function initialRoleForVerifiedEmail(email: string, initialAdminEmail: string): Role {
  return email.trim().toLowerCase() === initialAdminEmail.trim().toLowerCase() ? "admin" : "developer";
}
