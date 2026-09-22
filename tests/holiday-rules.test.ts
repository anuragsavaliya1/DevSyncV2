/** Unit coverage for company holiday rules. */
import { describe, expect, it } from "vitest";
import {
  assertHolidayDateValid,
  canManageHolidays,
  validateHolidayName,
} from "../lib/holiday-rules";
import { buildAttendanceMonth } from "../lib/attendance-month";
import { canManageHolidays as canManageHolidaysClient } from "../constants/permissions";
import {
  defaultWorkspaceTab,
  resolveWorkspaceLocation,
} from "../constants/routes";

describe("holiday authorization", () => {
  it("allows Admin and Manager to manage holidays", () => {
    expect(canManageHolidays("admin")).toBe(true);
    expect(canManageHolidays("manager")).toBe(true);
    expect(canManageHolidaysClient("admin")).toBe(true);
    expect(canManageHolidaysClient("manager")).toBe(true);
  });

  it("blocks Developer from holiday management", () => {
    expect(canManageHolidays("developer")).toBe(false);
    expect(
      resolveWorkspaceLocation(
        { tab: "holidays", employeeId: null },
        "developer",
      ),
    ).toEqual({ tab: "my-updates", employeeId: null });
  });

  it("keeps Admin/Manager landing on dashboard", () => {
    expect(defaultWorkspaceTab("admin")).toBe("overview");
    expect(defaultWorkspaceTab("manager")).toBe("overview");
  });
});

describe("holiday validation", () => {
  it("requires a holiday name", () => {
    expect(() => validateHolidayName("  ")).toThrow("Holiday name is required.");
  });

  it("accepts a valid date and name", () => {
    expect(assertHolidayDateValid("2026-10-02")).toBe("2026-10-02");
    expect(validateHolidayName(" Gandhi Jayanti ")).toBe("Gandhi Jayanti");
  });
});

describe("attendance month holiday + future leave", () => {
  it("marks holiday dates including future ones", () => {
    const holidayByDate = new Map([
      ["2026-09-21", { id: "h1", name: "Company Off", kind: "holiday" as const }],
    ]);
    const ledger = buildAttendanceMonth({
      month: "2026-09",
      today: "2026-09-15",
      attendanceByDate: new Map(),
      correctionByWorkDate: new Map(),
      holidayByDate,
    });
    const day = ledger.days.find((item) => item.date === "2026-09-21");
    expect(day?.status).toBe("holiday");
    expect(day?.holidayInfo?.name).toBe("Company Off");
  });

  it("marks configured week off as weekend on the calendar", () => {
    const holidayByDate = new Map([
      ["2026-09-19", { id: "w1", name: "Saturday off", kind: "weekoff" as const }],
    ]);
    const ledger = buildAttendanceMonth({
      month: "2026-09",
      today: "2026-09-15",
      attendanceByDate: new Map(),
      correctionByWorkDate: new Map(),
      holidayByDate,
    });
    const day = ledger.days.find((item) => item.date === "2026-09-19");
    expect(day?.status).toBe("weekend");
    expect(day?.holidayInfo?.kind).toBe("weekoff");
    expect(day?.holidayInfo?.name).toBe("Saturday off");
  });

  it("marks future approved leave on the calendar", () => {
    const leaveInfoByDate = new Map([
      [
        "2026-09-22",
        {
          id: "l1",
          status: "approved" as const,
          dayPortion: "full" as const,
          leaveType: "casual" as const,
          reason: "Trip",
          rejectionReason: null,
        },
      ],
    ]);
    const ledger = buildAttendanceMonth({
      month: "2026-09",
      today: "2026-09-15",
      attendanceByDate: new Map(),
      correctionByWorkDate: new Map(),
      approvedLeaveDates: new Set(["2026-09-22"]),
      leaveInfoByDate,
    });
    expect(ledger.days.find((item) => item.date === "2026-09-22")?.status).toBe(
      "leave",
    );
  });

  it("keeps holiday priority over leave on the same date", () => {
    const ledger = buildAttendanceMonth({
      month: "2026-09",
      today: "2026-09-15",
      attendanceByDate: new Map(),
      correctionByWorkDate: new Map(),
      approvedLeaveDates: new Set(["2026-09-18"]),
      holidayByDate: new Map([
        ["2026-09-18", { id: "h2", name: "Festival", kind: "holiday" }],
      ]),
    });
    expect(ledger.days.find((item) => item.date === "2026-09-18")?.status).toBe(
      "holiday",
    );
  });
});
