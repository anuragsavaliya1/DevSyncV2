/** Unit coverage for start/limit list pagination helpers. */
import { describe, expect, it } from "vitest";
import {
  listResponseWithOptionalPaging,
  paginateList,
  parseListPagination,
} from "../lib/pagination";

describe("parseListPagination", () => {
  it("defaults start to 0 and limit to 10", () => {
    expect(parseListPagination(new URLSearchParams())).toEqual({
      start: 0,
      limit: 10,
    });
  });

  it("clamps invalid and oversized limits", () => {
    expect(
      parseListPagination(new URLSearchParams("start=-5&limit=999")),
    ).toEqual({ start: 0, limit: 100 });
    expect(
      parseListPagination(new URLSearchParams("start=20&limit=abc")),
    ).toEqual({ start: 20, limit: 10 });
  });
});

describe("paginateList", () => {
  it("slices items and reports total", () => {
    const items = [1, 2, 3, 4, 5];
    expect(paginateList(items, 2, 2)).toEqual({
      items: [3, 4],
      start: 2,
      limit: 2,
      total: 5,
    });
  });
});

describe("listResponseWithOptionalPaging", () => {
  it("returns full list when start/limit absent", () => {
    expect(
      listResponseWithOptionalPaging(
        "rows",
        [1, 2, 3],
        new URLSearchParams(),
      ),
    ).toEqual({ rows: [1, 2, 3] });
  });

  it("paginates when start or limit is present", () => {
    expect(
      listResponseWithOptionalPaging(
        "rows",
        [1, 2, 3, 4],
        new URLSearchParams("start=1&limit=2"),
      ),
    ).toEqual({ rows: [2, 3], total: 4, start: 1, limit: 2 });
  });
});
