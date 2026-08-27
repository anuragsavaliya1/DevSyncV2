/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmployeeDetailCanvas } from "../components/workspace/employee-detail-canvas";

const detail = {
  employee: { id: "employee-id", email: "employee@example.com", displayName: "Employee", photoUrl: null, role: "developer" as const, isActive: true },
  updates: [],
  tasks: {
    pending: [{ id: "task-id", description: "QA task", status: "pending" as const, assignedAt: "2026-08-27T06:00:00.000Z", completedAt: null, remarks: [] }],
    completed: [],
  },
  summary: { totalUpdates: 0, totalMinutes: 0, pendingTasks: 1 },
};

const fetchMock = vi.fn();

describe("EmployeeDetailCanvas", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((_: string, init?: RequestInit) => Promise.resolve({
      ok: init?.method !== "DELETE",
      json: async () => init?.method === "DELETE" ? { error: "Task is already archived." } : detail,
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows a clear archive failure and retains the task when the server rejects a delete", async () => {
    render(<EmployeeDetailCanvas employeeId="employee-id" viewerRole="admin" onBack={vi.fn()} onChanged={vi.fn()} />);

    await screen.findByText("QA task");
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    fireEvent.click(screen.getByRole("button", { name: "Archive task" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Task is already archived.");
    expect(screen.getByText("QA task")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/task-id", expect.objectContaining({ method: "DELETE" }));
  });
});
