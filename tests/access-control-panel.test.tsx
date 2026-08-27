/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccessControlPanel } from "../components/workspace/team-management";

const users = [
  { id: "admin-id", email: "admin@example.com", displayName: "Admin", photoUrl: null, role: "admin" as const, isActive: true, createdAt: "2026-08-27T00:00:00.000Z", lastSignedInAt: "2026-08-27T00:00:00.000Z" },
  { id: "developer-id", email: "developer@example.com", displayName: "Developer", photoUrl: null, role: "developer" as const, isActive: true, createdAt: "2026-08-27T00:00:00.000Z", lastSignedInAt: "2026-08-27T00:00:00.000Z" },
];

describe("AccessControlPanel", () => {
  it("surfaces a failed activity change as a visually distinct, clear status without changing the employee", async () => {
    const onChangeActivity = vi.fn().mockRejectedValue(new Error("Forbidden"));
    render(<AccessControlPanel users={users} selfId="admin-id" initialAdminEmail="admin@example.com" isBusy={false} onChangeRole={vi.fn()} onChangeActivity={onChangeActivity} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Deactivate" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Deactivate employee" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Forbidden");
    expect(status).toHaveClass("text-[#A64D43]");
    await waitFor(() => expect(onChangeActivity).toHaveBeenCalledWith("developer-id", false));
    expect(screen.getAllByText("Active")).toHaveLength(2);
  });
});
