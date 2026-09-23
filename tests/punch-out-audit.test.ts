/** Unit coverage for punch-out origin persistence and audit visibility helpers. */
import { describe, expect, it } from "vitest";
import {
  buildPunchOutAudit,
  employeePunchOutFields,
  isManagedPunchOutSource,
  resolvePunchOutSource,
  teamAttendanceStatusLabel,
  teamAttendanceStatusTags,
} from "../lib/punch-out-audit";

describe("punch-out source persistence helpers", () => {
  it("stores employee punch-out without a Manager/Admin actor", () => {
    const now = new Date("2026-09-11T13:00:00.000Z");
    expect(employeePunchOutFields(now)).toEqual({
      state: "punched_out",
      punchOutAt: now,
      punchOutSource: "employee",
      punchOutRecordedByUserId: null,
      punchOutRecordedByRole: null,
      updatedAt: now,
    });
  });

  it("treats legacy punched-out rows without source as employee", () => {
    expect(
      resolvePunchOutSource({
        punchOutAt: "2026-09-11T13:00:00.000Z",
        punchOutSource: undefined,
      }),
    ).toBe("employee");
    expect(resolvePunchOutSource({ punchOutAt: null })).toBeNull();
  });

  it("flags only managed sources for special UI treatment", () => {
    expect(isManagedPunchOutSource("employee")).toBe(false);
    expect(isManagedPunchOutSource("regularization")).toBe(true);
    expect(isManagedPunchOutSource("manual")).toBe(true);
    expect(isManagedPunchOutSource(null)).toBe(false);
  });

  it("labels manual punch separately from regularization and surfaces late", () => {
    expect(
      teamAttendanceStatusLabel({
        record: {
          state: "punched_out",
          classification: "on_time",
          punchInAt: "2026-09-17T03:30:00.000Z",
          punchOutAt: "2026-09-17T12:00:00.000Z",
          punchOutSource: "manual",
        },
      }),
    ).toBe("Manual · On time");
    expect(
      teamAttendanceStatusLabel({
        record: {
          state: "punched_out",
          classification: "on_time",
          punchInAt: "2026-09-17T03:30:00.000Z",
          punchOutAt: "2026-09-17T12:00:00.000Z",
          punchOutSource: "regularization",
        },
      }),
    ).toBe("Regularized · On time");
    expect(
      teamAttendanceStatusTags({
        record: {
          state: "working",
          classification: "late",
          punchInAt: "2026-09-17T05:00:00.000Z",
        },
      }),
    ).toEqual(["Working", "Late"]);
    expect(
      teamAttendanceStatusTags({
        record: {
          state: "working",
          classification: "on_time",
          punchInAt: "2026-09-17T03:30:00.000Z",
        },
      }),
    ).toEqual(["Working", "On time"]);
    expect(
      teamAttendanceStatusTags({
        record: {
          state: "punched_out",
          classification: "late",
          punchInAt: "2026-09-17T05:00:00.000Z",
          punchOutAt: "2026-09-17T12:00:00.000Z",
          punchOutSource: "manual",
        },
      }),
    ).toEqual(["Manual", "Late"]);
    expect(
      teamAttendanceStatusTags({
        record: {
          state: "punched_out",
          classification: "late",
          punchInAt: "2026-09-17T05:00:00.000Z",
          punchOutAt: "2026-09-17T12:00:00.000Z",
          punchOutSource: "regularization",
        },
      }),
    ).toEqual(["Regularized", "Late"]);
    expect(
      teamAttendanceStatusLabel({
        record: {
          state: "punched_out",
          classification: "late",
          punchInAt: "2026-09-17T05:00:00.000Z",
          punchOutAt: "2026-09-17T12:00:00.000Z",
          punchOutSource: "employee",
        },
      }),
    ).toBe("Late");
    expect(
      teamAttendanceStatusLabel({
        record: {
          state: "punched_out",
          classification: "on_time",
          punchInAt: "2026-09-17T03:30:00.000Z",
          punchOutAt: "2026-09-17T12:00:00.000Z",
          punchOutSource: "employee",
        },
      }),
    ).toBe("On time");
    expect(
      teamAttendanceStatusTags({
        record: null,
        onLeave: true,
      }),
    ).toEqual(["On Leave"]);
    expect(
      teamAttendanceStatusLabel({
        record: {
          state: "working",
          classification: "on_time",
          punchInAt: "2026-09-17T03:30:00.000Z",
        },
        onLeave: true,
      }),
    ).toBe("Working · On time · On Leave");
  });
});

describe("punch-out audit projection", () => {
  it("builds regularization audit with approver role snapshot", () => {
    const audit = buildPunchOutAudit({
      punchOutAt: "2026-09-11T13:01:00.000Z",
      punchOutSource: "regularization",
      punchOutRecordedByUserId: "mgr1",
      punchOutRecordedByRole: "manager",
      recordedAt: "2026-09-11T13:30:00.000Z",
      reason: "Forgot to punch out",
      requestStatus: "approved",
      requestedAt: "2026-09-11T13:20:00.000Z",
      actor: {
        id: "mgr1",
        displayName: "John Doe",
        email: "john@example.com",
        role: "admin",
      },
    });
    expect(audit).toMatchObject({
      source: "regularization",
      recordedBy: {
        id: "mgr1",
        displayName: "John Doe",
        role: "manager",
      },
      reason: "Forgot to punch out",
      requestStatus: "approved",
    });
  });

  it("builds manual audit with actor role snapshot", () => {
    const audit = buildPunchOutAudit({
      punchOutAt: "2026-09-11T13:01:00.000Z",
      punchOutSource: "manual",
      punchOutRecordedByUserId: "admin1",
      punchOutRecordedByRole: "admin",
      recordedAt: "2026-09-11T13:40:00.000Z",
      reason: "Employee left early",
      actor: {
        id: "admin1",
        displayName: "Ada Admin",
        email: "ada@example.com",
        role: "admin",
      },
    });
    expect(audit).toMatchObject({
      source: "manual",
      recordedBy: {
        id: "admin1",
        displayName: "Ada Admin",
        role: "admin",
      },
      reason: "Employee left early",
    });
  });

  it("does not invent a management actor for normal/legacy employee punch-outs", () => {
    expect(
      buildPunchOutAudit({
        punchOutAt: "2026-09-11T13:01:00.000Z",
        punchOutSource: "employee",
        punchOutRecordedByUserId: null,
        punchOutRecordedByRole: null,
        actor: {
          id: "spoof",
          displayName: "Spoof",
          email: "spoof@example.com",
          role: "admin",
        },
      }),
    ).toMatchObject({
      source: "employee",
      recordedBy: null,
    });

    expect(
      buildPunchOutAudit({
        punchOutAt: "2026-09-11T13:01:00.000Z",
        punchOutSource: undefined,
        punchOutRecordedByUserId: "spoof",
        punchOutRecordedByRole: "admin",
        actor: {
          id: "spoof",
          displayName: "Spoof",
          email: "spoof@example.com",
          role: "admin",
        },
      })?.source,
    ).toBe("employee");
  });
});
