import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db/mongodb", () => ({
  getMongoDatabase: vi.fn(),
}));

import { getMongoDatabase } from "@/lib/db/mongodb";
import { serverNow } from "@/lib/server-clock";

describe("serverNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T13:00:00.000Z")); // 18:30 IST host
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("uses MongoDB localTime instead of the host OS clock", async () => {
    const mongoTime = new Date("2026-09-17T13:00:00.000Z");
    // Simulate host clock skewed +30 minutes while Mongo stays correct.
    vi.setSystemTime(new Date("2026-09-17T13:30:00.000Z"));
    vi.mocked(getMongoDatabase).mockResolvedValue({
      command: vi.fn().mockResolvedValue({ localTime: mongoTime }),
    } as never);

    await expect(serverNow()).resolves.toEqual(mongoTime);
  });

  it("falls back to host Date when Mongo time is unavailable", async () => {
    vi.mocked(getMongoDatabase).mockRejectedValue(new Error("offline"));
    await expect(serverNow()).resolves.toEqual(
      new Date("2026-09-17T13:00:00.000Z"),
    );
  });
});
