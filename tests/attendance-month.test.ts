/** Unit coverage for monthly attendance ledger status and summary rules. */
import { describe, expect, it } from "vitest";
import {
  buildAttendanceMonth,
  eachDateKeyInMonth,
  formatHoursShort,
  getAttendanceDayStatus,
  hoursBetween,
  isIndiaWeekend,
  monthRangeKeys,
  shiftMonthKey,
  workedHoursBetween,
} from "../lib/attendance-month";

describe("attendance month range helpers", () => {
  it("builds exclusive month bounds and every date key", () => {
    expect(monthRangeKeys("2026-09")).toEqual({
      from: "2026-09-01",
      toExclusive: "2026-10-01",
    });
    const dates = eachDateKeyInMonth("2026-09");
    expect(dates).toHaveLength(30);
    expect(dates[0]).toBe("2026-09-01");
    expect(dates[29]).toBe("2026-09-30");
  });

  it("navigates previous and next months", () => {
    expect(shiftMonthKey("2026-09", -1)).toBe("2026-08");
    expect(shiftMonthKey("2026-09", 1)).toBe("2026-10");
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
  });
});

describe("attendance day status", () => {
  // 2026-09-11 is Friday IST; 2026-09-12 Saturday; 2026-09-14 Monday.
  const today = "2026-09-11";

  it("marks Sundays and future dates without calling them absent", () => {
    expect(isIndiaWeekend("2026-09-13")).toBe(true); // Sunday
    expect(isIndiaWeekend("2026-09-12")).toBe(false); // Saturday is a working day
    expect(
      getAttendanceDayStatus({ date: "2026-09-13", today, attendance: null }),
    ).toBe("weekend");
    expect(
      getAttendanceDayStatus({ date: "2026-09-14", today, attendance: null }),
    ).toBe("future");
  });

  it("marks past working days without attendance as absent", () => {
    expect(
      getAttendanceDayStatus({ date: "2026-09-10", today, attendance: null }),
    ).toBe("absent");
    // Saturday is a working day and can be absent
    expect(
      getAttendanceDayStatus({ date: "2026-09-05", today: "2026-09-11", attendance: null }),
    ).toBe("absent");
  });

  it("marks punch-out without punch-in as missing punch-in", () => {
    expect(
      getAttendanceDayStatus({
        date: "2026-09-10",
        today,
        attendance: {
          punchInAt: null,
          punchOutAt: "2026-09-10T12:40:00.000Z",
        },
      }),
    ).toBe("missing_punch_in");
  });

  it("marks regularized punch-in as regularized even when punch-out is employee", () => {
    expect(
      getAttendanceDayStatus({
        date: "2026-09-10",
        today,
        attendance: {
          punchInAt: "a",
          punchOutAt: "b",
          classification: "on_time",
          punchInSource: "regularization",
          punchOutSource: "employee",
        },
      }),
    ).toBe("regularized");
  });

  it("marks today open attendance as working, previous open as missing punch-out", () => {
    expect(
      getAttendanceDayStatus({
        date: today,
        today,
        attendance: { punchInAt: "2026-09-11T03:30:00.000Z", punchOutAt: null },
      }),
    ).toBe("working");
    expect(
      getAttendanceDayStatus({
        date: "2026-09-10",
        today,
        attendance: { punchInAt: "2026-09-10T03:30:00.000Z", punchOutAt: null },
      }),
    ).toBe("missing_punch_out");
  });

  it("marks completed attendance as present, late, regularized, or manual", () => {
    expect(
      getAttendanceDayStatus({
        date: "2026-09-10",
        today,
        attendance: {
          punchInAt: "a",
          punchOutAt: "b",
          classification: "on_time",
          punchOutSource: "employee",
        },
      }),
    ).toBe("present");
    expect(
      getAttendanceDayStatus({
        date: "2026-09-10",
        today,
        attendance: {
          punchInAt: "a",
          punchOutAt: "b",
          classification: "late",
          punchOutSource: "employee",
        },
      }),
    ).toBe("late");
    expect(
      getAttendanceDayStatus({
        date: "2026-09-10",
        today,
        attendance: {
          punchInAt: "a",
          punchOutAt: "b",
          classification: "late",
          punchOutSource: "regularization",
        },
      }),
    ).toBe("regularized");
    expect(
      getAttendanceDayStatus({
        date: "2026-09-10",
        today,
        attendance: {
          punchInAt: "a",
          punchOutAt: "b",
          punchOutSource: "manual",
        },
      }),
    ).toBe("manual");
  });
});

describe("buildAttendanceMonth", () => {
  it("fills every day and summarizes without counting future/weekend as absent", () => {
    const today = "2026-09-11";
    const attendanceByDate = new Map([
      [
        "2026-09-10",
        {
          id: "a1",
          workDate: "2026-09-10",
          punchInAt: "2026-09-10T03:30:00.000Z",
          punchOutAt: "2026-09-10T13:00:00.000Z",
          classification: "on_time" as const,
          state: "punched_out" as const,
          punchOutSource: "employee" as const,
        },
      ],
      [
        "2026-09-11",
        {
          id: "a2",
          workDate: "2026-09-11",
          punchInAt: "2026-09-11T03:40:00.000Z",
          classification: "on_time" as const,
          state: "working" as const,
        },
      ],
    ]);
    const ledger = buildAttendanceMonth({
      month: "2026-09",
      today,
      attendanceByDate,
      correctionByWorkDate: new Map(),
    });
    expect(ledger.days).toHaveLength(30);
    expect(ledger.days.find((d) => d.date === "2026-09-11")?.status).toBe(
      "working",
    );
    expect(ledger.days.find((d) => d.date === "2026-09-09")?.status).toBe(
      "absent",
    );
    expect(ledger.days.find((d) => d.date === "2026-09-14")?.status).toBe(
      "future",
    );
    expect(ledger.days.find((d) => d.date === "2026-09-13")?.status).toBe(
      "weekend",
    );
    // Saturday is a working day; with today=2026-09-11 it is still future.
    expect(ledger.days.find((d) => d.date === "2026-09-12")?.status).toBe(
      "future",
    );
    expect(ledger.summary.present).toBe(2);
    expect(ledger.summary.workingDays).toBe(26);
    // Absents no longer count as needs-action; open today is "working".
    expect(ledger.summary.needsAction).toBe(0);
    // 9.5h span minus 1h lunch/tea break
    expect(ledger.days.find((d) => d.date === "2026-09-10")?.totalHours).toBe(
      8.5,
    );
  });

  it("marks only approved leave dates as leave (not pending/rejected)", () => {
    const today = "2026-09-11";
    const leaveInfoByDate = new Map([
      [
        "2026-09-10",
        {
          id: "l1",
          status: "approved" as const,
          dayPortion: "full" as const,
          leaveType: "casual" as const,
          reason: "Family function",
          rejectionReason: null,
        },
      ],
      [
        "2026-09-09",
        {
          id: "l2",
          status: "rejected" as const,
          dayPortion: "full" as const,
          leaveType: "sick" as const,
          reason: "Fever",
          rejectionReason: "Busy week",
        },
      ],
    ]);
    const ledger = buildAttendanceMonth({
      month: "2026-09",
      today,
      attendanceByDate: new Map(),
      correctionByWorkDate: new Map(),
      approvedLeaveDates: new Set(["2026-09-10", "2026-09-15"]),
      leaveInfoByDate,
    });
    expect(ledger.days.find((d) => d.date === "2026-09-10")?.status).toBe(
      "leave",
    );
    expect(ledger.days.find((d) => d.date === "2026-09-15")?.status).toBe(
      "leave",
    );
    expect(ledger.summary.leave).toBe(2);
    expect(ledger.days.find((d) => d.date === "2026-09-13")?.status).toBe(
      "weekend",
    );
    expect(ledger.days.find((d) => d.date === "2026-09-09")?.status).toBe(
      "absent",
    );
    expect(
      ledger.days.find((d) => d.date === "2026-09-09")?.leaveInfo?.rejectionReason,
    ).toBe("Busy week");
  });

  it("shows punch status instead of leave when attendance exists on a leave date", () => {
    const today = "2026-09-11";
    const leaveInfoByDate = new Map([
      [
        "2026-09-10",
        {
          id: "l1",
          status: "approved" as const,
          dayPortion: "hours_2" as const,
          leaveType: "casual" as const,
          reason: "Doctor visit",
          rejectionReason: null,
        },
      ],
    ]);
    const ledger = buildAttendanceMonth({
      month: "2026-09",
      today,
      attendanceByDate: new Map([
        [
          "2026-09-10",
          {
            id: "a1",
            workDate: "2026-09-10",
            punchInAt: "2026-09-10T03:30:00.000Z",
            punchOutAt: "2026-09-10T12:00:00.000Z",
            classification: "on_time" as const,
            state: "punched_out" as const,
          },
        ],
      ]),
      correctionByWorkDate: new Map(),
      approvedLeaveDates: new Set(["2026-09-10"]),
      leaveInfoByDate,
    });
    const day = ledger.days.find((d) => d.date === "2026-09-10");
    // Attendance status wins so Present/Late counts stay correct…
    expect(day?.status).toBe("present");
    // …but leave metadata stays for calendar overlay (half / hourly leave).
    expect(day?.leaveInfo?.status).toBe("approved");
    expect(day?.leaveInfo?.dayPortion).toBe("hours_2");
    expect(day?.leaveInfo?.reason).toBe("Doctor visit");
  });

  it("marks hourly other-duration leave as leave when there is no punch", () => {
    const today = "2026-09-11";
    const leaveInfoByDate = new Map([
      [
        "2026-09-10",
        {
          id: "l1",
          status: "approved" as const,
          dayPortion: "hours_1" as const,
          leaveType: "other" as const,
          reason: "Personal work",
          rejectionReason: null,
        },
      ],
    ]);
    const ledger = buildAttendanceMonth({
      month: "2026-09",
      today,
      attendanceByDate: new Map(),
      correctionByWorkDate: new Map(),
      approvedLeaveDates: new Set(["2026-09-10"]),
      leaveInfoByDate,
    });
    const day = ledger.days.find((d) => d.date === "2026-09-10");
    expect(day?.status).toBe("leave");
    expect(day?.leaveInfo?.dayPortion).toBe("hours_1");
  });

  it("counts Present over full-month working days (minus week-off and holiday)", () => {
    const today = "2026-09-18";
    const holidayByDate = new Map([
      [
        "2026-09-25",
        {
          id: "h1",
          name: "Ganesh Visarjan",
          kind: "holiday" as const,
        },
      ],
      [
        "2026-09-05",
        {
          id: "w1",
          name: "Saturday off",
          kind: "weekoff" as const,
        },
      ],
      [
        "2026-09-12",
        {
          id: "w2",
          name: "Saturday off",
          kind: "weekoff" as const,
        },
      ],
      [
        "2026-09-19",
        {
          id: "w3",
          name: "Saturday off",
          kind: "weekoff" as const,
        },
      ],
      [
        "2026-09-26",
        {
          id: "w4",
          name: "Saturday off",
          kind: "weekoff" as const,
        },
      ],
    ]);
    const attendanceByDate = new Map([
      [
        "2026-09-10",
        {
          id: "a1",
          workDate: "2026-09-10",
          punchInAt: "2026-09-10T03:30:00.000Z",
          punchOutAt: "2026-09-10T13:00:00.000Z",
          classification: "on_time" as const,
          state: "punched_out" as const,
        },
      ],
      [
        "2026-09-18",
        {
          id: "a2",
          workDate: "2026-09-18",
          punchInAt: "2026-09-18T03:57:00.000Z",
          classification: "late" as const,
          state: "working" as const,
        },
      ],
    ]);
    const ledger = buildAttendanceMonth({
      month: "2026-09",
      today,
      attendanceByDate,
      correctionByWorkDate: new Map(),
      holidayByDate,
    });
    // 30 days − 4 Sundays − 4 Saturday week-offs − 1 holiday = 21
    expect(ledger.summary.workingDays).toBe(21);
    // Closed present day + today working with punch-in
    expect(ledger.summary.present).toBe(2);
    expect(ledger.summary.needsAction).toBe(0);
  });

  it("needs action counts missing punches only, not absents", () => {
    const today = "2026-09-18";
    const attendanceByDate = new Map([
      [
        "2026-09-04",
        {
          id: "a1",
          workDate: "2026-09-04",
          punchInAt: "2026-09-04T03:30:00.000Z",
          classification: "on_time" as const,
          state: "working" as const,
        },
      ],
    ]);
    const ledger = buildAttendanceMonth({
      month: "2026-09",
      today,
      attendanceByDate,
      correctionByWorkDate: new Map(),
    });
    expect(ledger.days.find((d) => d.date === "2026-09-04")?.status).toBe(
      "missing_punch_out",
    );
    expect(ledger.days.find((d) => d.date === "2026-09-02")?.status).toBe(
      "absent",
    );
    expect(ledger.summary.needsAction).toBe(1);
  });

  it("sums hours in whole minutes for hr/min display", () => {
    const today = "2026-09-18";
    const attendanceByDate = new Map([
      [
        "2026-09-10",
        {
          id: "a1",
          workDate: "2026-09-10",
          punchInAt: "2026-09-10T03:30:00.000Z", // 09:00
          punchOutAt: "2026-09-10T12:40:00.000Z", // 18:10 → 9.17h gross → 8.17h net
          classification: "on_time" as const,
          state: "punched_out" as const,
        },
      ],
      [
        "2026-09-11",
        {
          id: "a2",
          workDate: "2026-09-11",
          punchInAt: "2026-09-11T03:30:00.000Z",
          punchOutAt: "2026-09-11T13:00:00.000Z", // 8.5h net
          classification: "on_time" as const,
          state: "punched_out" as const,
        },
      ],
    ]);
    const ledger = buildAttendanceMonth({
      month: "2026-09",
      today,
      attendanceByDate,
      correctionByWorkDate: new Map(),
    });
    const expectedMinutes =
      Math.round((ledger.days.find((d) => d.date === "2026-09-10")!.totalHours!) * 60) +
      Math.round((ledger.days.find((d) => d.date === "2026-09-11")!.totalHours!) * 60);
    expect(Math.round(ledger.summary.hours * 60)).toBe(expectedMinutes);
    expect(formatHoursShort(ledger.summary.hours)).toMatch(/h/);
  });
});

describe("worked hours with lunch + tea break", () => {
  it("subtracts 1 hour from gross punch span", () => {
    const inAt = "2026-09-11T03:30:00.000Z"; // 09:00 IST
    const outAt = "2026-09-11T13:00:00.000Z"; // 18:30 IST
    expect(hoursBetween(inAt, outAt)).toBe(9.5);
    expect(workedHoursBetween(inAt, outAt)).toBe(8.5);
  });
});
