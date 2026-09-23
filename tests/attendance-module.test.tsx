/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttendanceModule } from "@/features/attendance/components/attendance-module";
import type { WorkspaceUser } from "@/types/api.types";

const mockUseAttendanceMonth = vi.fn();
const mockUseTeamAttendance = vi.fn();
const mockUseTeamAttendancePage = vi.fn();
const mockUsePendingPunchOutCorrectionRequests = vi.fn();
const mockUsePendingPunchOutCorrectionRequestsPage = vi.fn();

vi.mock("@/features/attendance/hooks/use-attendance", () => ({
  useAttendanceMonth: (...args: unknown[]) => mockUseAttendanceMonth(...args),
  useTeamAttendance: (...args: unknown[]) => mockUseTeamAttendance(...args),
  useTeamAttendancePage: (...args: unknown[]) =>
    mockUseTeamAttendancePage(...args),
  useAttendance: vi.fn(),
  usePunch: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/features/attendance/hooks/use-punch-out-corrections", () => ({
  usePendingPunchOutCorrectionRequests: (...args: unknown[]) =>
    mockUsePendingPunchOutCorrectionRequests(...args),
  usePendingPunchOutCorrectionRequestsPage: (...args: unknown[]) =>
    mockUsePendingPunchOutCorrectionRequestsPage(...args),
  useCreatePunchOutCorrectionRequest: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useApprovePunchOutCorrectionRequest: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRejectPunchOutCorrectionRequest: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useManualPunchOutEmployee: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

const developerUser: WorkspaceUser = {
  id: "dev-user-id",
  email: "dev@example.com",
  displayName: "Dev User",
  photoUrl: null,
  role: "developer",
  isActive: true,
  createdAt: "2026-08-01T00:00:00.000Z",
  lastSignedInAt: "2026-09-18T00:00:00.000Z",
};

const managerUser: WorkspaceUser = {
  id: "manager-user-id",
  email: "manager@example.com",
  displayName: "Manager User",
  photoUrl: null,
  role: "manager",
  isActive: true,
  createdAt: "2026-08-01T00:00:00.000Z",
  lastSignedInAt: "2026-09-18T00:00:00.000Z",
};

const adminUser: WorkspaceUser = {
  id: "admin-user-id",
  email: "admin@example.com",
  displayName: "Admin User",
  photoUrl: null,
  role: "admin",
  isActive: true,
  createdAt: "2026-08-01T00:00:00.000Z",
  lastSignedInAt: "2026-09-18T00:00:00.000Z",
};

describe("AttendanceModule role behavior", () => {
  beforeEach(() => {
    mockUseAttendanceMonth.mockReturnValue({
      data: {
        month: "2026-09",
        summary: {
          present: 15,
          late: 1,
          leave: 0,
          hours: 120,
          needsAction: 0,
          workingDays: 22,
        },
        days: [],
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    });

    mockUseTeamAttendance.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
    });

    mockUseTeamAttendancePage.mockReturnValue({
      data: {
        page: { items: [], total: 0, start: 0, limit: 10 },
        summary: { present: 0, onLeave: 0, absent: 0, total: 0 },
      },
      isLoading: false,
      isFetching: false,
      error: null,
    });

    mockUsePendingPunchOutCorrectionRequests.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    mockUsePendingPunchOutCorrectionRequestsPage.mockReturnValue({
      data: { items: [], total: 0, start: 0, limit: 10 },
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("DEVELOPER role", () => {
    it("directly renders Self Attendance Ledger without tabs or employee selector", () => {
      render(
        <AttendanceModule
          user={developerUser}
          role="developer"
          attendance={null}
          businessDate="2026-09-18"
          canViewTeam={false}
        />
      );

      // Should not have any tab switcher
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
      expect(screen.queryByRole("tab")).not.toBeInTheDocument();

      // Should not render Team Attendance content
      expect(screen.queryByText("Pending review queue")).not.toBeInTheDocument();

      // Should render self review header and ledger
      expect(screen.getByText("Attendance · Self review")).toBeInTheDocument();

      // Month ledger query should be called
      expect(mockUseAttendanceMonth).toHaveBeenCalled();
      // Team queries should not be called because TeamAttendanceView was never mounted
      expect(mockUseTeamAttendance).not.toHaveBeenCalled();

      // Ensure no employee/user selector dropdown exists
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });
  });

  describe("ADMIN role", () => {
    it("directly renders Team Attendance without manager tabs or self review tab", () => {
      render(
        <AttendanceModule
          user={adminUser}
          role="admin"
          attendance={null}
          businessDate="2026-09-18"
          canViewTeam={true}
        />
      );

      // Should not have any tab switcher
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
      expect(screen.queryByRole("tab")).not.toBeInTheDocument();

      // Should render Team Attendance content
      expect(screen.getByText("Pending review queue")).toBeInTheDocument();
      expect(screen.getByText("Team attendance")).toBeInTheDocument();

      // Team attendance query should be called
      expect(mockUseTeamAttendancePage).toHaveBeenCalled();
      // Self attendance query should not be called because SelfAttendanceLedger was never mounted
      expect(mockUseAttendanceMonth).not.toHaveBeenCalled();
    });
  });

  describe("MANAGER role", () => {
    it("renders exactly two tabs defaulting to Team attendance", () => {
      render(
        <AttendanceModule
          user={managerUser}
          role="manager"
          attendance={null}
          businessDate="2026-09-18"
          canViewTeam={true}
        />
      );

      const tablist = screen.getByRole("tablist", { name: "Attendance views" });
      expect(tablist).toBeInTheDocument();

      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(2);

      const selfTab = screen.getByRole("tab", {
        name: "Attendance · Self review",
      });
      const teamTab = screen.getByRole("tab", { name: "Team attendance" });

      expect(selfTab).toBeInTheDocument();
      expect(teamTab).toBeInTheDocument();

      // Default selected tab is Team attendance
      expect(teamTab).toHaveAttribute("aria-selected", "true");
      expect(selfTab).toHaveAttribute("aria-selected", "false");

      // Default view renders Team Attendance
      expect(screen.getByText("Pending review queue")).toBeInTheDocument();

      // Self Attendance Ledger is unmounted initially
      expect(mockUseAttendanceMonth).not.toHaveBeenCalled();
      expect(mockUseTeamAttendancePage).toHaveBeenCalled();
    });

    it("switches to Self review, showing manager's own attendance with NO user dropdown, and unmounts Team attendance", () => {
      render(
        <AttendanceModule
          user={managerUser}
          role="manager"
          attendance={null}
          businessDate="2026-09-18"
          canViewTeam={true}
        />
      );

      const selfTab = screen.getByRole("tab", {
        name: "Attendance · Self review",
      });
      const teamTab = screen.getByRole("tab", { name: "Team attendance" });

      // Click Self Review tab
      fireEvent.click(selfTab);

      expect(selfTab).toHaveAttribute("aria-selected", "true");
      expect(teamTab).toHaveAttribute("aria-selected", "false");

      // Self attendance ledger is now mounted
      expect(mockUseAttendanceMonth).toHaveBeenCalled();

      // Team attendance view is unmounted
      expect(screen.queryByText("Pending review queue")).not.toBeInTheDocument();

      // Ensure no employee/user selector dropdown exists in Manager Self Review
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/user/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/employee/i)).not.toBeInTheDocument();
    });

    it("switches back to Team attendance from Self review", () => {
      render(
        <AttendanceModule
          user={managerUser}
          role="manager"
          attendance={null}
          businessDate="2026-09-18"
          canViewTeam={true}
        />
      );

      const selfTab = screen.getByRole("tab", {
        name: "Attendance · Self review",
      });
      const teamTab = screen.getByRole("tab", { name: "Team attendance" });

      // Switch to Self Review
      fireEvent.click(selfTab);
      expect(screen.queryByText("Pending review queue")).not.toBeInTheDocument();

      // Switch back to Team Attendance
      fireEvent.click(teamTab);
      expect(teamTab).toHaveAttribute("aria-selected", "true");
      expect(selfTab).toHaveAttribute("aria-selected", "false");
      expect(screen.getByText("Pending review queue")).toBeInTheDocument();
    });

    it("supports keyboard navigation on manager tabs", () => {
      render(
        <AttendanceModule
          user={managerUser}
          role="manager"
          attendance={null}
          businessDate="2026-09-18"
          canViewTeam={true}
        />
      );

      const teamTab = screen.getByRole("tab", { name: "Team attendance" });
      const selfTab = screen.getByRole("tab", {
        name: "Attendance · Self review",
      });

      // Initially on Team tab. Pressing ArrowLeft navigates to Self tab
      fireEvent.keyDown(teamTab, { key: "ArrowLeft" });
      expect(selfTab).toHaveAttribute("aria-selected", "true");

      // On Self tab. Pressing ArrowRight navigates back to Team tab
      fireEvent.keyDown(selfTab, { key: "ArrowRight" });
      expect(teamTab).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("Fallback role detection", () => {
    it("falls back to developer view when canViewTeam is false and no user is provided", () => {
      render(
        <AttendanceModule
          businessDate="2026-09-18"
          canViewTeam={false}
        />
      );

      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
      expect(screen.getByText("Attendance · Self review")).toBeInTheDocument();
    });

    it("falls back to admin view when canViewTeam is true and no user is provided", () => {
      render(
        <AttendanceModule
          businessDate="2026-09-18"
          canViewTeam={true}
        />
      );

      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
      expect(screen.getByText("Pending review queue")).toBeInTheDocument();
    });
  });
});
