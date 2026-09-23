/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmployeeDetailCanvas } from "../components/workspace/employee-detail-canvas";

const detail = {
  employee: {
    id: "employee-id",
    email: "employee@example.com",
    displayName: "Employee",
    photoUrl: null,
    role: "developer" as const,
    isActive: true,
  },
  updates: [],
  tasks: {
    pending: [
      {
        id: "task-id",
        developerUserId: "employee-id",
        assignedByUserId: "manager-id",
        description: "QA task",
        priority: "medium" as const,
        dueDate: null,
        dueTime: null,
        status: "pending" as const,
        assignedAt: "2026-08-27T06:00:00.000Z",
        completedAt: null,
        remarks: [],
      },
    ],
    completed: [],
  },
  summary: { totalUpdates: 0, totalMinutes: 0, pendingTasks: 1 },
};

const fetchMock = vi.fn();

describe("EmployeeDetailCanvas", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((_: string, init?: RequestInit) =>
      Promise.resolve({
        ok: init?.method !== "DELETE",
        json: async () =>
          init?.method === "DELETE"
            ? { error: "Task could not be deleted." }
            : detail,
      })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows a clear delete failure and retains the task when the server rejects a delete", async () => {
    render(
      <EmployeeDetailCanvas
        employeeId="employee-id"
        viewerRole="admin"
        onBack={vi.fn()}
        onChanged={vi.fn()}
      />
    );

    await screen.findByText("QA task");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Task could not be deleted."
    );
    expect(screen.getAllByText("QA task").length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tasks/task-id",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
