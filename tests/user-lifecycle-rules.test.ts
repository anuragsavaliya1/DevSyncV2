import { describe, expect, it } from "vitest";
import { userActivityChangeError } from "../lib/user-lifecycle-rules";

describe("employee lifecycle safeguards", () => {
  const initialAdminEmail = "anurag.xitijinfo@gmail.com";

  it("protects the configured initial Admin from deactivation", () => {
    expect(userActivityChangeError({ actorUserId: "admin-2", targetUserId: "admin-1", targetEmail: initialAdminEmail, nextIsActive: false, initialAdminEmail })).toMatch(/initial Admin/i);
  });

  it("prevents an administrator from disabling their own session", () => {
    expect(userActivityChangeError({ actorUserId: "admin-1", targetUserId: "admin-1", targetEmail: "other@example.com", nextIsActive: false, initialAdminEmail })).toMatch(/own account/i);
  });

  it("permits a different employee to be deactivated or reactivated", () => {
    expect(userActivityChangeError({ actorUserId: "admin-1", targetUserId: "developer-1", targetEmail: "developer@example.com", nextIsActive: false, initialAdminEmail })).toBeNull();
    expect(userActivityChangeError({ actorUserId: "admin-1", targetUserId: "developer-1", targetEmail: "developer@example.com", nextIsActive: true, initialAdminEmail })).toBeNull();
  });
});
