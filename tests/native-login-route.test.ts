import { describe, expect, it } from "vitest";
import { GET } from "../app/login/native/route";

describe("native Firebase sign-in route", () => {
  it("renders a visible retryable error path instead of an unbounded loader", async () => {
    const response = await GET(
      new Request("http://localhost/login/native?devAuthTest=error")
    );
    const html = await response.text();

    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(html).toContain('id="error"');
    expect(html).toContain("Google sign-in needs attention.");
    expect(html).toContain("Try Google sign-in again");
    expect(html).toContain("button.disabled = false");
    expect(html).toContain("dev/controlled-failure");
  });
});
