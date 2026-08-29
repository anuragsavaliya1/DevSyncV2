/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RoleManagementSkeleton, WorkspaceSkeleton } from "../components/workspace/loading-skeletons";

afterEach(() => cleanup());

describe("loading skeletons", () => {
  it("announces workspace loading and renders shimmer blocks", () => {
    const { container } = render(<WorkspaceSkeleton />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading workspace data…")).toBeInTheDocument();
    expect(container.querySelectorAll(".skeleton-shimmer").length).toBeGreaterThan(4);
  });

  it("renders the role-management placeholder with an accessible loading status", () => {
    render(<RoleManagementSkeleton />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading workspace data…")).toBeInTheDocument();
  });
});
