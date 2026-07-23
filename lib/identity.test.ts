import { describe, it, expect } from "vitest";
import { namesMatch } from "./identity";

describe("namesMatch", () => {
  it("matches identical names", () => {
    expect(namesMatch("Alex Rivera", "Alex Rivera")).toBe(true);
  });
  it("is case- and whitespace-insensitive", () => {
    expect(namesMatch("  alex   RIVERA ", "Alex Rivera")).toBe(true);
  });
  it("rejects different names", () => {
    expect(namesMatch("Alex Rivera", "Sam Chen")).toBe(false);
  });
  it("rejects partial matches", () => {
    expect(namesMatch("Alex Rivera", "Alex Riveraa")).toBe(false);
    expect(namesMatch("Alex", "Alex Rivera")).toBe(false);
  });
  it("handles null/empty profile names safely", () => {
    expect(namesMatch(null, "Alex Rivera")).toBe(false);
    expect(namesMatch("Alex Rivera", "")).toBe(false);
  });
});
