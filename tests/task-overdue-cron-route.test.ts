/** Route coverage for the secured overdue-task cron endpoint. */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  notifyOverdueAssignedTasks: vi.fn(),
}));

vi.mock("@/lib/operations", () => ({
  notifyOverdueAssignedTasks: mocks.notifyOverdueAssignedTasks,
}));

import {
  GET as cronGet,
  POST as cronPost,
} from "../app/api/cron/task-overdue/route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-cron-secret";
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("task-overdue cron route", () => {
  it("rejects unauthorized callers", async () => {
    const response = await cronGet(
      new NextRequest("http://localhost/api/cron/task-overdue"),
    );
    expect(response.status).toBe(401);
    expect(mocks.notifyOverdueAssignedTasks).not.toHaveBeenCalled();
  });

  it("runs the overdue batch when authorized", async () => {
    mocks.notifyOverdueAssignedTasks.mockResolvedValue({
      ran: true,
      scanned: 3,
      overdue: 2,
      sent: 2,
      failures: 0,
    });

    const response = await cronPost(
      new NextRequest("http://localhost/api/cron/task-overdue", {
        method: "POST",
        headers: { Authorization: "Bearer test-cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      sent: 2,
      overdue: 2,
    });
  });
});
