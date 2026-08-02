import { describe, it, expect, afterEach } from "vitest";
import { namesMatch, isIdentityMockEnabled } from "./identity";

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

describe("isIdentityMockEnabled", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;

  afterEach(() => {
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
  });

  // The mock awards a real Verified badge to anyone who clicks "pass", so
  // production must refuse it — otherwise the badge means nothing.
  it("is disabled in production", () => {
    process.env.VERCEL_ENV = "production";
    expect(isIdentityMockEnabled()).toBe(false);
  });

  it("is enabled on preview deployments", () => {
    process.env.VERCEL_ENV = "preview";
    expect(isIdentityMockEnabled()).toBe(true);
  });

  it("is enabled locally, where VERCEL_ENV is unset", () => {
    delete process.env.VERCEL_ENV;
    expect(isIdentityMockEnabled()).toBe(true);
  });
});
