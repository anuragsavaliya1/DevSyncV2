import { describe, expect, it } from "vitest";
import {
  assertAttendanceReportMonthRange,
  buildAutoKey,
  buildEmployeeSummaries,
  countMonthWorkingDays,
  countPresentDaysByEmployee,
  eachMonthKeyInclusive,
  earlyDepartureDetails,
  excelFilenameForMonth,
  excelFilenameForReport,
  filterAttendanceReportByEmployee,
  generateAttendanceReportEntries,
  lateArrivalDetails,
  mergeAttendanceReportEntries,
  mergeAttendanceReportSlices,
  reportMonthRangeLabel,
  summarizeAttendanceReport,
} from "../lib/attendance-report-rules";
import {
  OFFICE_END_MINUTES,
  classifyOfficePunchOut,
} from "../lib/operation-rules";

const ankit = {
  id: "emp-ankit",
  displayName: "Ankit",
  email: "ankit@example.com",
};
const bhautik = {
  id: "emp-bhautik",
  displayName: "Bhautik",
  email: "bhautik@example.com",
};
const bhavin = {
  id: "emp-bhavin",
  displayName: "Bhavin",
  email: "bhavin@example.com",
};

/** 12:00 IST on 2026-09-02 → late vs 09:00 */
const latePunchIn = "2026-09-02T06:30:00.000Z";
/** 14:30 IST on 2026-09-05 */
const earlyPunchOut = "2026-09-05T09:00:00.000Z";
/** 18:30 IST on-time out */
const onTimeOut = "2026-09-02T13:00:00.000Z";
/** 09:00 IST on-time in */
const onTimeIn = "2026-09-02T03:30:00.000Z";

describe("office end early classification", () => {
  it("uses 18:30 IST when punch-in is at/before 09:00", () => {
    expect(OFFICE_END_MINUTES).toBe(18 * 60 + 30);
    expect(classifyOfficePunchOut(14 * 60 + 30, 9 * 60)).toBe("early");
    expect(classifyOfficePunchOut(18 * 60 + 30, 9 * 60)).toBe("on_time");
  });

  it("shifts expected end when punch-in is after 09:00", () => {
    // 09:05 → expected 18:35
    expect(classifyOfficePunchOut(18 * 60 + 34, 9 * 60 + 5)).toBe("early");
    expect(classifyOfficePunchOut(18 * 60 + 35, 9 * 60 + 5)).toBe("on_time");
    // 09:15 → expected 18:45
    expect(classifyOfficePunchOut(18 * 60 + 44, 9 * 60 + 15)).toBe("early");
    expect(classifyOfficePunchOut(18 * 60 + 45, 9 * 60 + 15)).toBe("on_time");
  });
});

describe("lateArrivalDetails / earlyDepartureDetails", () => {
  it("calculates late duration from punch-in vs 09:00 IST", () => {
    expect(lateArrivalDetails(latePunchIn)).toBe("3 hours late");
  });

  it("formats early departure with clock time and early-by duration", () => {
    expect(earlyDepartureDetails(earlyPunchOut, onTimeIn.replace("2026-09-02", "2026-09-05"))).toMatch(/Left at/);
    expect(earlyDepartureDetails(earlyPunchOut, onTimeIn.replace("2026-09-02", "2026-09-05"))).toMatch(/Early by 4 hours/);
  });
});

describe("generateAttendanceReportEntries", () => {
  const today = "2026-09-20";
  const monthKey = "2026-09";

  it("detects late arrival with calculated duration", () => {
    const entries = generateAttendanceReportEntries({
      monthKey,
      today,
      employees: [ankit],
      attendance: [
        {
          userId: ankit.id,
          workDate: "2026-09-02",
          punchInAt: latePunchIn,
          punchOutAt: onTimeOut,
          classification: "late",
        },
      ],
      leaves: [],
    });
    const late = entries.find((row) => row.action === "Arrived Late");
    expect(late).toMatchObject({
      date: "2026-09-02",
      employeeName: "Ankit",
      action: "Arrived Late",
      details: "3 hours late",
      source: "attendance",
    });
  });

  it("detects early departure", () => {
    const entries = generateAttendanceReportEntries({
      monthKey,
      today,
      employees: [bhautik],
      attendance: [
        {
          userId: bhautik.id,
          workDate: "2026-09-05",
          punchInAt: "2026-09-05T03:30:00.000Z",
          punchOutAt: earlyPunchOut,
          classification: "on_time",
        },
      ],
      leaves: [],
    });
    const early = entries.find((row) => row.action === "Going Early");
    expect(early?.employeeName).toBe("Bhautik");
    expect(early?.details).toContain("Left at");
  });

  it("does not count late within 15-minute grace (through 09:15)", () => {
    const entries = generateAttendanceReportEntries({
      monthKey,
      today,
      employees: [ankit],
      attendance: [
        {
          userId: ankit.id,
          workDate: "2026-09-02",
          // 09:15 IST
          punchInAt: "2026-09-02T03:45:00.000Z",
          punchOutAt: "2026-09-02T13:15:00.000Z",
          classification: "late",
        },
      ],
      leaves: [],
    });
    expect(entries.some((row) => row.action === "Arrived Late")).toBe(false);
  });

  it("counts late only after 09:15 IST", () => {
    const entries = generateAttendanceReportEntries({
      monthKey,
      today,
      employees: [ankit],
      attendance: [
        {
          userId: ankit.id,
          workDate: "2026-09-02",
          // 09:16 IST
          punchInAt: "2026-09-02T03:46:00.000Z",
          punchOutAt: "2026-09-02T13:16:00.000Z",
          classification: "on_time",
        },
      ],
      leaves: [],
    });
    expect(entries.some((row) => row.action === "Arrived Late")).toBe(true);
  });

  it("shifts early threshold when punch-in is after 09:00", () => {
    const entries = generateAttendanceReportEntries({
      monthKey,
      today,
      employees: [bhautik],
      attendance: [
        {
          userId: bhautik.id,
          workDate: "2026-09-05",
          // 09:05 IST → expected out 18:35
          punchInAt: "2026-09-05T03:35:00.000Z",
          // 18:30 IST — early vs 18:35
          punchOutAt: "2026-09-05T13:00:00.000Z",
          classification: "on_time",
        },
      ],
      leaves: [],
    });
    const early = entries.find((row) => row.action === "Going Early");
    expect(early).toBeTruthy();
    expect(early?.details).toMatch(/Early by 5 minutes/);

    const onTimeOut = generateAttendanceReportEntries({
      monthKey,
      today,
      employees: [bhautik],
      attendance: [
        {
          userId: bhautik.id,
          workDate: "2026-09-05",
          punchInAt: "2026-09-05T03:35:00.000Z",
          // 18:35 IST
          punchOutAt: "2026-09-05T13:05:00.000Z",
          classification: "on_time",
        },
      ],
      leaves: [],
    });
    expect(onTimeOut.some((row) => row.action === "Going Early")).toBe(false);
  });

  it("includes only approved leave as On Leave", () => {
    const entries = generateAttendanceReportEntries({
      monthKey,
      today,
      employees: [bhavin],
      attendance: [],
      leaves: [
        {
          id: "lv1",
          userId: bhavin.id,
          leaveType: "casual",
          dayPortion: "full",
          startDate: "2026-09-08",
          endDate: "2026-09-08",
          status: "approved",
        },
        {
          id: "lv2",
          userId: bhavin.id,
          leaveType: "sick",
          dayPortion: "full",
          startDate: "2026-09-09",
          endDate: "2026-09-09",
          status: "pending",
        },
        {
          id: "lv3",
          userId: bhavin.id,
          leaveType: "sick",
          dayPortion: "full",
          startDate: "2026-09-10",
          endDate: "2026-09-10",
          status: "rejected",
        },
      ],
    });
    const leaveRows = entries.filter((row) => row.action === "On Leave");
    expect(leaveRows).toHaveLength(1);
    expect(leaveRows[0]).toMatchObject({
      date: "2026-09-08",
      details: "Casual Leave",
      source: "leave",
    });
    // Pending day without attendance is absent, not On Leave
    expect(
      entries.some(
        (row) => row.date === "2026-09-09" && row.action === "On Leave",
      ),
    ).toBe(false);
  });

  it("does not mark approved leave as Absent", () => {
    const entries = generateAttendanceReportEntries({
      monthKey,
      today,
      employees: [bhavin],
      attendance: [],
      leaves: [
        {
          id: "lv1",
          userId: bhavin.id,
          leaveType: "sick",
          dayPortion: "half",
          startDate: "2026-09-08",
          endDate: "2026-09-08",
          status: "approved",
        },
      ],
    });
    expect(
      entries.some(
        (row) => row.date === "2026-09-08" && row.action === "Absent",
      ),
    ).toBe(false);
    expect(entries.find((row) => row.action === "On Leave")?.details).toContain(
      "Half Day",
    );
  });

  it("detects missing punch out on past days", () => {
    const entries = generateAttendanceReportEntries({
      monthKey,
      today,
      employees: [ankit],
      attendance: [
        {
          userId: ankit.id,
          workDate: "2026-09-15",
          punchInAt: onTimeIn.replace("2026-09-02", "2026-09-15"),
          punchOutAt: null,
          classification: "on_time",
        },
      ],
      leaves: [],
    });
    expect(
      entries.find((row) => row.action === "Missing Punch"),
    ).toMatchObject({
      date: "2026-09-15",
      details: "Punch Out missing",
    });
  });

  it("does not generate future attendance exceptions", () => {
    const entries = generateAttendanceReportEntries({
      monthKey,
      today: "2026-09-05",
      employees: [ankit],
      attendance: [],
      leaves: [],
    });
    expect(entries.every((row) => row.date <= "2026-09-05")).toBe(true);
  });

  it("does not duplicate automatic entries", () => {
    const entries = generateAttendanceReportEntries({
      monthKey,
      today,
      employees: [ankit],
      attendance: [
        {
          userId: ankit.id,
          workDate: "2026-09-02",
          punchInAt: latePunchIn,
          punchOutAt: onTimeOut,
          classification: "late",
        },
      ],
      leaves: [],
    });
    const keys = entries.map((row) => row.autoKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(
      entries.filter(
        (row) =>
          row.autoKey ===
          buildAutoKey({
            date: "2026-09-02",
            employeeId: ankit.id,
            action: "Arrived Late",
          }),
      ),
    ).toHaveLength(1);
  });

  it("supports late and early on the same day", () => {
    const entries = generateAttendanceReportEntries({
      monthKey,
      today,
      employees: [ankit],
      attendance: [
        {
          userId: ankit.id,
          workDate: "2026-09-02",
          punchInAt: latePunchIn,
          punchOutAt: earlyPunchOut.replace("2026-09-05", "2026-09-02"),
          classification: "late",
        },
      ],
      leaves: [],
    });
    expect(entries.some((row) => row.action === "Arrived Late")).toBe(true);
    expect(entries.some((row) => row.action === "Going Early")).toBe(true);
  });

  it("skips Sundays", () => {
    // 2026-09-06 is Sunday
    const entries = generateAttendanceReportEntries({
      monthKey,
      today,
      employees: [ankit],
      attendance: [],
      leaves: [],
    });
    expect(entries.some((row) => row.date === "2026-09-06")).toBe(false);
  });
});

describe("mergeAttendanceReportEntries", () => {
  it("keeps manuals and applies remarks without duplicating autos", () => {
    const auto = generateAttendanceReportEntries({
      monthKey: "2026-09",
      today: "2026-09-20",
      employees: [ankit],
      attendance: [
        {
          userId: ankit.id,
          workDate: "2026-09-02",
          punchInAt: latePunchIn,
          punchOutAt: onTimeOut,
          classification: "late",
        },
      ],
      leaves: [],
    });
    const lateKey = buildAutoKey({
      date: "2026-09-02",
      employeeId: ankit.id,
      action: "Arrived Late",
    });
    const merged = mergeAttendanceReportEntries({
      autoEntries: auto,
      employees: [ankit],
      overlays: [
        {
          id: "ov1",
          autoKey: lateKey,
          date: "2026-09-02",
          employeeId: ankit.id,
          action: "Arrived Late",
          details: "3 hours late",
          managerRemark: "Traffic",
          source: "attendance",
        },
        {
          id: "man1",
          autoKey: null,
          date: "2026-09-03",
          employeeId: ankit.id,
          action: "Other",
          details: "Client site visit",
          managerRemark: "",
          source: "manual",
        },
      ],
    });
    expect(merged.find((row) => row.autoKey === lateKey)?.managerRemark).toBe(
      "Traffic",
    );
    expect(merged.some((row) => row.source === "manual")).toBe(true);
  });

  it("suppresses deleted auto overlays on regenerate", () => {
    const auto = generateAttendanceReportEntries({
      monthKey: "2026-09",
      today: "2026-09-20",
      employees: [ankit],
      attendance: [
        {
          userId: ankit.id,
          workDate: "2026-09-02",
          punchInAt: latePunchIn,
          punchOutAt: onTimeOut,
          classification: "late",
        },
      ],
      leaves: [],
    });
    const lateKey = buildAutoKey({
      date: "2026-09-02",
      employeeId: ankit.id,
      action: "Arrived Late",
    });
    const merged = mergeAttendanceReportEntries({
      autoEntries: auto,
      employees: [ankit],
      overlays: [
        {
          id: "ov1",
          autoKey: lateKey,
          date: "2026-09-02",
          employeeId: ankit.id,
          action: "Arrived Late",
          details: "3 hours late",
          managerRemark: "",
          source: "attendance",
          deleted: true,
        },
      ],
    });
    expect(merged.some((row) => row.autoKey === lateKey)).toBe(false);
  });
});

describe("summarizeAttendanceReport", () => {
  it("counts occurrences not unique employees", () => {
    const entries = mergeAttendanceReportEntries({
      autoEntries: generateAttendanceReportEntries({
        monthKey: "2026-09",
        today: "2026-09-20",
        employees: [ankit, bhautik],
        attendance: [
          {
            userId: ankit.id,
            workDate: "2026-09-01",
            punchInAt: latePunchIn.replace("2026-09-02", "2026-09-01"),
            punchOutAt: onTimeOut.replace("2026-09-02", "2026-09-01"),
            classification: "late",
          },
          {
            userId: ankit.id,
            workDate: "2026-09-02",
            punchInAt: latePunchIn,
            punchOutAt: onTimeOut,
            classification: "late",
          },
        ],
        leaves: [],
      }),
      overlays: [],
      employees: [ankit, bhautik],
    });
    const summary = summarizeAttendanceReport(entries, 2);
    expect(summary.totalEmployees).toBe(2);
    expect(summary.lateArrivals).toBe(2);
    const presentByEmployeeId = new Map([[ankit.id, 7]]);
    const emp = buildEmployeeSummaries(
      entries,
      [ankit, bhautik],
      23,
      presentByEmployeeId,
    );
    expect(emp.find((row) => row.employeeId === ankit.id)?.late).toBe(2);
    expect(emp.find((row) => row.employeeId === ankit.id)?.workingDays).toBe(23);
    expect(emp.find((row) => row.employeeId === ankit.id)?.present).toBe(7);
    expect(emp.find((row) => row.employeeId === bhautik.id)?.present).toBe(0);
  });
});

describe("countMonthWorkingDays", () => {
  it("subtracts Sundays, week-offs, and holidays from month length", () => {
    expect(
      countMonthWorkingDays("2026-09", [
        { date: "2026-09-05", kind: "weekoff" },
        { date: "2026-09-12", kind: "weekoff" },
        { date: "2026-09-19", kind: "weekoff" },
        { date: "2026-09-26", kind: "weekoff" },
        { date: "2026-09-25", kind: "holiday" },
      ]),
    ).toBe(21);
    // Sundays only (no Saturday week-offs / holidays): 30 − 4 = 26
    expect(countMonthWorkingDays("2026-09")).toBe(26);
  });
});

describe("countPresentDaysByEmployee", () => {
  it("counts present/late/working days and skips leave and week-off", () => {
    const present = countPresentDaysByEmployee({
      monthKey: "2026-09",
      today: "2026-09-11",
      employees: [ankit],
      attendance: [
        {
          userId: ankit.id,
          workDate: "2026-09-10",
          punchInAt: "2026-09-10T03:30:00.000Z",
          punchOutAt: "2026-09-10T13:00:00.000Z",
          classification: "on_time",
        },
        {
          userId: ankit.id,
          workDate: "2026-09-11",
          punchInAt: "2026-09-11T04:00:00.000Z",
          classification: "late",
        },
      ],
      leaves: [
        {
          id: "l1",
          userId: ankit.id,
          leaveType: "casual",
          dayPortion: "full",
          startDate: "2026-09-09",
          endDate: "2026-09-09",
          status: "approved",
        },
      ],
      holidays: [{ date: "2026-09-05", kind: "weekoff" }],
    });
    expect(present.get(ankit.id)).toBe(2);
  });
});

describe("excelFilenameForMonth", () => {
  it("includes month name and year", () => {
    expect(excelFilenameForMonth("2026-09")).toBe(
      "DevSync_Attendance_Report_September_2026.xlsx",
    );
  });
});

describe("attendance report month range helpers", () => {
  it("lists inclusive months for any valid range", () => {
    expect(eachMonthKeyInclusive("2026-07", "2026-09")).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(assertAttendanceReportMonthRange("2026-07", "2026-09")).toHaveLength(
      3,
    );
    expect(assertAttendanceReportMonthRange("2026-01", "2026-08")).toHaveLength(
      8,
    );
    expect(() =>
      assertAttendanceReportMonthRange("2026-09", "2026-07"),
    ).toThrow(/From month cannot be after to month/);
    expect(reportMonthRangeLabel("2026-09", "2026-09")).toBe("September 2026");
    expect(reportMonthRangeLabel("2026-07", "2026-09")).toBe(
      "July 2026 – September 2026",
    );
  });

  it("filters and merges month slices for one employee", () => {
    const july = {
      month: "2026-07",
      monthLabel: "July 2026",
      summary: {
        totalEmployees: 2,
        lateArrivals: 1,
        earlyDepartures: 0,
        leaves: 0,
        absences: 0,
        missingPunches: 0,
        other: 0,
      },
      employees: [ankit, bhautik],
      employeeSummary: [
        {
          employeeId: ankit.id,
          employeeName: "Ankit",
          workingDays: 22,
          present: 20,
          late: 1,
          early: 0,
          leave: 0,
          absent: 1,
          missingPunch: 0,
          other: 0,
        },
        {
          employeeId: bhautik.id,
          employeeName: "Bhautik",
          workingDays: 22,
          present: 22,
          late: 0,
          early: 0,
          leave: 0,
          absent: 0,
          missingPunch: 0,
          other: 0,
        },
      ],
      entries: [
        {
          id: "e1",
          autoKey: "a1",
          date: "2026-07-02",
          employeeId: ankit.id,
          employeeName: "Ankit",
          action: "Arrived Late" as const,
          details: "late",
          managerRemark: "",
          source: "attendance" as const,
          isManual: false,
          isEditable: true,
        },
      ],
    };
    const august = {
      ...july,
      month: "2026-08",
      monthLabel: "August 2026",
      entries: [
        {
          id: "e2",
          autoKey: "a2",
          date: "2026-08-05",
          employeeId: ankit.id,
          employeeName: "Ankit",
          action: "Absent" as const,
          details: "absent",
          managerRemark: "",
          source: "attendance" as const,
          isManual: false,
          isEditable: true,
        },
      ],
      employeeSummary: [
        {
          employeeId: ankit.id,
          employeeName: "Ankit",
          workingDays: 21,
          present: 19,
          late: 0,
          early: 0,
          leave: 0,
          absent: 1,
          missingPunch: 0,
          other: 0,
        },
      ],
    };

    const filtered = filterAttendanceReportByEmployee(july, ankit.id);
    expect(filtered.employees).toHaveLength(1);
    expect(filtered.entries).toHaveLength(1);

    const merged = mergeAttendanceReportSlices([july, august], {
      employeeId: ankit.id,
    });
    expect(merged.fromMonth).toBe("2026-07");
    expect(merged.toMonth).toBe("2026-08");
    expect(merged.employees).toHaveLength(1);
    expect(merged.entries.map((entry) => entry.id)).toEqual(["e1", "e2"]);
    expect(merged.employeeSummary[0]?.workingDays).toBe(43);
    expect(merged.employeeSummary[0]?.present).toBe(39);
    expect(merged.monthSummaries).toHaveLength(2);
    expect(
      excelFilenameForReport({
        fromMonth: "2026-07",
        toMonth: "2026-09",
        employeeName: "Ankit",
      }),
    ).toContain("July_2026_to_September_2026");
  });
});
