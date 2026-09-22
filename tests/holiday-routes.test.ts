/** Route-level coverage for holiday APIs. */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listCompanyHolidays: vi.fn(),
  createCompanyHoliday: vi.fn(),
  deleteCompanyHoliday: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/operations", () => ({
  listCompanyHolidays: mocks.listCompanyHolidays,
  createCompanyHoliday: mocks.createCompanyHoliday,
  deleteCompanyHoliday: mocks.deleteCompanyHoliday,
}));

import {
  GET as listHolidays,
  POST as createHoliday,
} from "../app/api/holidays/route";
import { DELETE as deleteHoliday } from "../app/api/holidays/[holidayId]/route";

const developer = {
  id: "507f1f77bcf86cd799439011",
  firebaseUid: "dev-uid",
  email: "dev@example.com",
  displayName: "Dev",
  photoUrl: null,
  role: "developer" as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedInAt: new Date(),
};

const manager = {
  ...developer,
  id: "507f1f77bcf86cd799439012",
  role: "manager" as const,
  email: "mgr@example.com",
  displayName: "Manager",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("holiday routes", () => {
  it("lets Manager list holidays", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.listCompanyHolidays.mockResolvedValue([
      { id: "h1", date: "2026-10-02", name: "Gandhi Jayanti" },
    ]);
    const response = await listHolidays();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      holidays: [{ id: "h1", date: "2026-10-02", name: "Gandhi Jayanti" }],
    });
  });

  it("lets Developer list holidays for leave validation", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);
    mocks.listCompanyHolidays.mockResolvedValue([
      { id: "h1", date: "2026-10-02", name: "Gandhi Jayanti", kind: "holiday" },
    ]);
    const response = await listHolidays();
    expect(response.status).toBe(200);
    expect(mocks.listCompanyHolidays).toHaveBeenCalledWith(developer);
  });

  it("blocks Developer create through operations Forbidden", async () => {
    mocks.getCurrentUser.mockResolvedValue(developer);
    mocks.createCompanyHoliday.mockRejectedValue(
      new Error("Only a Manager or Admin can manage holidays."),
    );
    const response = await createHoliday(
      new NextRequest("http://localhost/api/holidays", {
        method: "POST",
        body: JSON.stringify({ date: "2026-10-02", name: "Holiday" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(response.status).toBe(403);
  });

  it("creates a holiday for Manager", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.createCompanyHoliday.mockResolvedValue({
      id: "h1",
      date: "2026-10-02",
      name: "Gandhi Jayanti",
    });
    const response = await createHoliday(
      new NextRequest("http://localhost/api/holidays", {
        method: "POST",
        body: JSON.stringify({ date: "2026-10-02", name: "Gandhi Jayanti" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.createCompanyHoliday).toHaveBeenCalledWith(manager, {
      date: "2026-10-02",
      name: "Gandhi Jayanti",
      kind: "holiday",
    });
  });

  it("deletes a holiday", async () => {
    mocks.getCurrentUser.mockResolvedValue(manager);
    mocks.deleteCompanyHoliday.mockResolvedValue({
      deleted: true,
      id: "507f1f77bcf86cd799439099",
    });
    const response = await deleteHoliday(new Request("http://localhost"), {
      params: Promise.resolve({ holidayId: "507f1f77bcf86cd799439099" }),
    });
    expect(response.status).toBe(200);
  });
});
