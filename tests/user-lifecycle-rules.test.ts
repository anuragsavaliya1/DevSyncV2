import { describe, expect, it } from "vitest";
import {
  userActivityChangeError,
  userPermanentDeleteError,
  userRoleChangeError,
} from "../lib/user-lifecycle-rules";

describe("employee lifecycle safeguards", () => {
  const initialAdminEmail = "anurag.xitijinfo@gmail.com";

  it("protects the configured initial Admin from deactivation", () => {
    expect(
      userActivityChangeError({
        actorUserId: "admin-2",
        targetUserId: "admin-1",
        targetEmail: initialAdminEmail,
        nextIsActive: false,
        initialAdminEmail,
      })
    ).toMatch(/initial Admin/i);
  });

  it("prevents an administrator from disabling their own session", () => {
    expect(
      userActivityChangeError({
        actorUserId: "admin-1",
        targetUserId: "admin-1",
        targetEmail: "other@example.com",
        nextIsActive: false,
        initialAdminEmail,
      })
    ).toMatch(/own account/i);
  });

  it("permits a different employee to be deactivated or reactivated", () => {
    expect(
      userActivityChangeError({
        actorUserId: "admin-1",
        targetUserId: "developer-1",
        targetEmail: "developer@example.com",
        nextIsActive: false,
        initialAdminEmail,
      })
    ).toBeNull();
    expect(
      userActivityChangeError({
        actorUserId: "admin-1",
        targetUserId: "developer-1",
        targetEmail: "developer@example.com",
        nextIsActive: true,
        initialAdminEmail,
      })
    ).toBeNull();
  });

  it("blocks deactivation of the last active administrator", () => {
    expect(
      userActivityChangeError({
        actorUserId: "admin-1",
        targetUserId: "admin-2",
        targetEmail: "other-admin@example.com",
        targetRole: "admin",
        activeAdminCount: 1,
        nextIsActive: false,
        initialAdminEmail,
      })
    ).toMatch(/last active Admin/i);
  });

  it("blocks permanent deletion of the actor, initial Admin, or another administrator", () => {
    expect(
      userPermanentDeleteError({
        actorUserId: "admin-1",
        targetUserId: "admin-1",
        targetEmail: "employee@example.com",
        targetRole: "developer",
        initialAdminEmail,
      })
    ).toMatch(/own account/i);
    expect(
      userPermanentDeleteError({
        actorUserId: "admin-1",
        targetUserId: "developer-1",
        targetEmail: initialAdminEmail,
        targetRole: "developer",
        initialAdminEmail,
      })
    ).toMatch(/initial Admin/i);
    expect(
      userPermanentDeleteError({
        actorUserId: "admin-1",
        targetUserId: "admin-2",
        targetEmail: "other-admin@example.com",
        targetRole: "admin",
        initialAdminEmail,
      })
    ).toMatch(/Administrator accounts/i);
    expect(
      userPermanentDeleteError({
        actorUserId: "admin-1",
        targetUserId: "developer-1",
        targetEmail: "developer@example.com",
        targetRole: "developer",
        initialAdminEmail,
      })
    ).toBeNull();
  });

  it("blocks demoting the last active administrator", () => {
    expect(
      userRoleChangeError({
        targetEmail: "other-admin@example.com",
        targetRole: "admin",
        targetIsActive: true,
        nextRole: "manager",
        initialAdminEmail,
        activeAdminCount: 1,
      })
    ).toMatch(/last active Admin/i);
    expect(
      userRoleChangeError({
        targetEmail: "other-admin@example.com",
        targetRole: "admin",
        targetIsActive: true,
        nextRole: "manager",
        initialAdminEmail,
        activeAdminCount: 2,
      })
    ).toBeNull();
  });
});
