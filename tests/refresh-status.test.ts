import { describe, expect, it } from "vitest";
import { getRefreshStatus } from "../lib/refresh-status";

describe("workspace refresh status", () => {
  it("distinguishes the initial connection state from an idle workspace", () => {
    expect(getRefreshStatus(null, true)).toBe("Connecting to workspace data…");
    expect(getRefreshStatus(null, false)).toBe("Waiting for workspace data");
  });

  it("keeps the previously completed sync visible during a background refresh", () => {
    const timestamp = "2026-08-27T05:30:45.000Z";

    expect(getRefreshStatus(timestamp, false)).toContain("Synced");
    expect(getRefreshStatus(timestamp, false)).not.toMatch(/GMT|IST|UTC/);
    expect(getRefreshStatus(timestamp, true)).toContain(
      "Refreshing · last synced"
    );
  });
});
