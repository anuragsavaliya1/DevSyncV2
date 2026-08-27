import { describe, expect, it } from "vitest";
import { apiError } from "../lib/api-errors";

describe("apiError", () => {
  it("maps authorization and validation failures to distinct safe response statuses", () => {
    expect(apiError(new Error("Forbidden"), "Fallback")).toEqual({ error: "Forbidden", status: 403 });
    expect(apiError(new Error("Task not found"), "Fallback")).toEqual({ error: "Task not found", status: 400 });
  });
});
