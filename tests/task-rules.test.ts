/** Unit tests for assigned-task priority and due-date rules. */
import { describe, expect, it } from "vitest";
import {
  assertTaskDueInput,
  buildTaskAssignedNotificationBody,
  formatTaskDueLabel,
  isTaskPastDue,
  normalizeTaskPriority,
  taskPriorityLabel,
} from "../lib/task-rules";

describe("task-rules", () => {
  it("normalizes unknown priority to medium", () => {
    expect(normalizeTaskPriority("urgent")).toBe("urgent");
    expect(normalizeTaskPriority("nope")).toBe("medium");
    expect(taskPriorityLabel("urgent")).toBe("High Urgency");
  });

  it("requires due date when due time is set", () => {
    const now = new Date("2026-09-17T05:00:00.000Z"); // 10:30 IST
    expect(() => assertTaskDueInput({ dueTime: "17:00" }, now)).toThrow(
      /Due date is required/,
    );
    expect(assertTaskDueInput({ dueDate: "2026-09-17" }, now)).toEqual({
      dueDate: "2026-09-17",
      dueTime: "23:59",
    });
    expect(
      assertTaskDueInput({ dueDate: "2026-09-17", dueTime: "17:00" }, now),
    ).toEqual({ dueDate: "2026-09-17", dueTime: "17:00" });
  });

  it("rejects past due date or time", () => {
    const now = new Date("2026-09-17T12:00:00.000Z"); // 17:30 IST
    expect(() =>
      assertTaskDueInput({ dueDate: "2026-09-16", dueTime: "18:00" }, now),
    ).toThrow(/past/);
    expect(() =>
      assertTaskDueInput({ dueDate: "2026-09-17", dueTime: "17:00" }, now),
    ).toThrow(/past/);
    expect(
      assertTaskDueInput({ dueDate: "2026-09-17", dueTime: "18:00" }, now),
    ).toEqual({ dueDate: "2026-09-17", dueTime: "18:00" });
  });

  it("detects overdue tasks in IST", () => {
    expect(
      isTaskPastDue({
        dueDate: "2026-09-17",
        dueTime: "17:00",
        now: new Date("2026-09-17T12:00:00.000Z"), // 17:30 IST
      }),
    ).toBe(true);
    expect(
      isTaskPastDue({
        dueDate: "2026-09-17",
        dueTime: "17:00",
        now: new Date("2026-09-17T11:00:00.000Z"), // 16:30 IST
      }),
    ).toBe(false);
  });

  it("builds assignee notification body with priority and due", () => {
    const body = buildTaskAssignedNotificationBody({
      description: "Review scripts",
      priority: "urgent",
      dueDate: "2026-09-17",
      dueTime: "17:00",
    });
    expect(body).toContain("Review scripts");
    expect(body).toContain("Priority: High Urgency");
    expect(body).toContain("Due:");
    expect(formatTaskDueLabel({ dueDate: "2026-09-17", dueTime: "17:00" })).toBeTruthy();
  });
});
