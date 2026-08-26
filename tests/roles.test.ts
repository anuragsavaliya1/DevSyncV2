/** Unit coverage for the immutable DevSync role vocabulary. */
import { describe, expect, it } from "vitest";
import { isRole, roles } from "../lib/roles";

describe("DevSync roles", () => {
  it("accepts only the three server-authorized roles", () => {
    expect(roles).toEqual(["developer", "manager", "admin"]);
    expect(isRole("developer")).toBe(true);
    expect(isRole("manager")).toBe(true);
    expect(isRole("admin")).toBe(true);
    expect(isRole("owner")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});
