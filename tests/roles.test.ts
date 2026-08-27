/** Unit coverage for the immutable DevSync role vocabulary. */
import { describe, expect, it } from "vitest";
import { isRole, roles } from "../lib/roles";
import { initialRoleForVerifiedEmail } from "../lib/provisioning";

describe("DevSync roles", () => {
  it("accepts only the three server-authorized roles", () => {
    expect(roles).toEqual(["developer", "manager", "admin"]);
    expect(isRole("developer")).toBe(true);
    expect(isRole("manager")).toBe(true);
    expect(isRole("admin")).toBe(true);
    expect(isRole("owner")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });

  it("provisions verified Google accounts as Developers except for the configured initial Admin", () => {
    expect(initialRoleForVerifiedEmail("anurag.xitijinfo@gmail.com", "anurag.xitijinfo@gmail.com")).toBe("admin");
    expect(initialRoleForVerifiedEmail("employee@example.com", "anurag.xitijinfo@gmail.com")).toBe("developer");
    expect(initialRoleForVerifiedEmail(" ANURAG.XITIJINFO@GMAIL.COM ", "anurag.xitijinfo@gmail.com")).toBe("admin");
  });
});
