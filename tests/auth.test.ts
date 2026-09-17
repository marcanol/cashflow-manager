import { describe, expect, it } from "vitest";
import { safeNextPath } from "../lib/auth/redirect";

describe("authentication redirects", () => {
  it("accepts only application-relative paths", () => {
    expect(safeNextPath("/plan")).toBe("/plan");
    expect(safeNextPath("https://example.com")).toBe("/");
    expect(safeNextPath("//example.com")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});
