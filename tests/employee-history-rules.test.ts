import { describe, expect, it } from "vitest";
import { normalizeEmployeeHistoryFilter } from "../lib/employee-history-rules";

describe("employee history filters", () => {
  it("derives stable date bounds for standard review ranges", () => {
    expect(normalizeEmployeeHistoryFilter({ range: "last_7_days" }, "2026-08-27")).toMatchObject({ fromDate: "2026-08-21", toDate: "2026-08-27" });
    expect(normalizeEmployeeHistoryFilter({ range: "this_month" }, "2026-08-27")).toMatchObject({ fromDate: "2026-08-01", toDate: "2026-08-27" });
    expect(normalizeEmployeeHistoryFilter({ range: "all_time" }, "2026-08-27")).toMatchObject({ fromDate: undefined, toDate: undefined });
  });

  it("honours valid explicit bounds and rejects reversed ranges", () => {
    expect(normalizeEmployeeHistoryFilter({ range: "all_time", fromDate: "2026-01-01", toDate: "2026-02-01", query: "  blocker  " }, "2026-08-27")).toMatchObject({ fromDate: "2026-01-01", toDate: "2026-02-01", query: "blocker" });
    expect(() => normalizeEmployeeHistoryFilter({ range: "all_time", fromDate: "2026-02-01", toDate: "2026-01-01" }, "2026-08-27")).toThrow(/Start date/);
  });
});
