import { describe, it, expect } from "vitest";
import { isAdminEmail } from "./admin";

describe("isAdminEmail", () => {
  const list = "founder@example.com, second@example.com";

  it("accepts an email on the allow-list", () => {
    expect(isAdminEmail("founder@example.com", list)).toBe(true);
  });
  it("ignores case and surrounding whitespace", () => {
    expect(isAdminEmail("  Founder@Example.com  ", list)).toBe(true);
  });
  it("accepts a later entry in the list", () => {
    expect(isAdminEmail("second@example.com", list)).toBe(true);
  });
  it("rejects an email not on the list", () => {
    expect(isAdminEmail("someone@example.com", list)).toBe(false);
  });
  it("fails closed when the allow-list is unset or empty", () => {
    expect(isAdminEmail("founder@example.com", undefined)).toBe(false);
    expect(isAdminEmail("founder@example.com", "")).toBe(false);
    expect(isAdminEmail("founder@example.com", "   ")).toBe(false);
    expect(isAdminEmail("founder@example.com", ",,")).toBe(false);
  });
  it("fails closed when the email is missing", () => {
    expect(isAdminEmail(null, list)).toBe(false);
    expect(isAdminEmail(undefined, list)).toBe(false);
    expect(isAdminEmail("", list)).toBe(false);
  });
});
