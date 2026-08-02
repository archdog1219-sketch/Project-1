import { describe, it, expect, afterEach } from "vitest";
import { generateOtpCode, isOtpValid, normalizePhone, OTP_TTL_MS, isPhoneOtpMockEnabled } from "./phone-otp";

describe("generateOtpCode", () => {
  it("returns a 6-digit numeric string", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateOtpCode()).toMatch(/^[0-9]{6}$/);
    }
  });
});

describe("isOtpValid", () => {
  const now = new Date("2026-07-23T12:00:00Z");
  const future = new Date(now.getTime() + 60_000);
  const past = new Date(now.getTime() - 1);

  it("accepts a matching, unexpired code", () => {
    expect(isOtpValid({ code: "123456", expiresAt: future }, "123456", now)).toBe(true);
  });
  it("ignores surrounding whitespace in the submitted code", () => {
    expect(isOtpValid({ code: "123456", expiresAt: future }, " 123456 ", now)).toBe(true);
  });
  it("rejects a wrong code", () => {
    expect(isOtpValid({ code: "123456", expiresAt: future }, "654321", now)).toBe(false);
  });
  it("rejects an expired code", () => {
    expect(isOtpValid({ code: "123456", expiresAt: past }, "123456", now)).toBe(false);
  });
  it("rejects when no code has been issued", () => {
    expect(isOtpValid({ code: null, expiresAt: future }, "123456", now)).toBe(false);
    expect(isOtpValid({ code: "123456", expiresAt: null }, "123456", now)).toBe(false);
  });
  it("rejects an empty submission even if stored code is empty", () => {
    expect(isOtpValid({ code: "", expiresAt: future }, "", now)).toBe(false);
  });
});

describe("normalizePhone", () => {
  it("strips formatting characters", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("5551234567");
  });
  it("preserves a leading plus for international numbers", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
  });
  it("trims surrounding whitespace", () => {
    expect(normalizePhone("  5551234567  ")).toBe("5551234567");
  });
});

describe("OTP_TTL_MS", () => {
  it("is ten minutes", () => {
    expect(OTP_TTL_MS).toBe(10 * 60 * 1000);
  });
});

describe("isPhoneOtpMockEnabled", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;

  afterEach(() => {
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
  });

  // The mock displays the OTP to anyone who knows the email address, so
  // production must refuse it — otherwise the page is an enumeration oracle.
  it("is disabled in production", () => {
    process.env.VERCEL_ENV = "production";
    expect(isPhoneOtpMockEnabled()).toBe(false);
  });

  it("is enabled on preview deployments", () => {
    process.env.VERCEL_ENV = "preview";
    expect(isPhoneOtpMockEnabled()).toBe(true);
  });

  it("is enabled locally, where VERCEL_ENV is unset", () => {
    delete process.env.VERCEL_ENV;
    expect(isPhoneOtpMockEnabled()).toBe(true);
  });
});
