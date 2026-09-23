/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccessControlPanel } from "../components/workspace/team-management";

afterEach(() => cleanup());

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const users = [
  {
    id: "admin-id",
    email: "admin@example.com",
    displayName: "Admin",
    photoUrl: null,
    role: "admin" as const,
    isActive: true,
    createdAt: "2026-08-27T00:00:00.000Z",
    lastSignedInAt: "2026-08-27T00:00:00.000Z",
  },
  {
    id: "developer-id",
    email: "developer@example.com",
    displayName: "Developer",
    photoUrl: null,
    role: "developer" as const,
    isActive: true,
    createdAt: "2026-08-27T00:00:00.000Z",
    lastSignedInAt: "2026-08-27T00:00:00.000Z",
  },
];

describe("AccessControlPanel", () => {
  it("surfaces a failed activity change as a visually distinct, clear status without changing the employee", async () => {
    const onChangeActivity = vi.fn().mockRejectedValue(new Error("Forbidden"));
    renderWithQuery(
      <AccessControlPanel
        users={users}
        selfId="admin-id"
        initialAdminEmail="admin@example.com"
        isBusy={false}
        onChangeRole={vi.fn()}
        onChangeActivity={onChangeActivity}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Deactivate" })[1]);
    fireEvent.click(
      screen.getByRole("button", { name: "Deactivate employee" })
    );

    await waitFor(() =>
      expect(onChangeActivity).toHaveBeenCalledWith("developer-id", false)
    );
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Forbidden");
    });
    expect(screen.getByRole("status")).toHaveClass("text-[#A64D43]");
    expect(screen.getAllByText("Active")).toHaveLength(2);
  });
});

it("requires an explicit DELETE confirmation and preserves the employee when deletion fails", async () => {
  const onDelete = vi.fn().mockRejectedValue(new Error("Delete failed"));
  renderWithQuery(
    <AccessControlPanel
      users={users}
      selfId="admin-id"
      initialAdminEmail="admin@example.com"
      isBusy={false}
      onChangeRole={vi.fn()}
      onChangeActivity={vi.fn()}
      onDelete={onDelete}
    />
  );

  fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]);
  const deleteButton = screen.getByRole("button", {
    name: "Delete permanently",
  });
  expect(deleteButton).toBeDisabled();

  fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
    target: { value: "DELETE" },
  });
  expect(deleteButton).toBeEnabled();
  fireEvent.click(deleteButton);

  await waitFor(() => {
    expect(onDelete).toHaveBeenCalledWith("developer-id");
  });
  await waitFor(() => {
    expect(screen.getByRole("status")).toHaveTextContent("Delete failed");
  });
  expect(screen.getByRole("status")).toHaveClass("text-[#A64D43]");
  expect(screen.getByText("developer@example.com")).toBeInTheDocument();
});

it("shows a success status after an employee is deleted", async () => {
  const onDelete = vi.fn().mockResolvedValue(undefined);
  renderWithQuery(
    <AccessControlPanel
      users={users}
      selfId="admin-id"
      initialAdminEmail="admin@example.com"
      isBusy={false}
      onChangeRole={vi.fn()}
      onChangeActivity={vi.fn()}
      onDelete={onDelete}
    />
  );

  fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]);
  fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
    target: { value: "delete" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));

  await waitFor(() => {
    expect(onDelete).toHaveBeenCalledWith("developer-id");
  });
  await waitFor(() => {
    expect(screen.getByRole("status")).toHaveTextContent(
      "Developer deleted successfully.",
    );
  });
  expect(screen.getByRole("status")).toHaveClass("text-[#087A6D]");
  expect(
    screen.queryByRole("dialog", { name: /Delete Developer permanently/i }),
  ).not.toBeInTheDocument();
});
