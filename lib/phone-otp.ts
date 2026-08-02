// ---------------------------------------------------------------------------
// Phone-OTP provider seam.
// Deliberately mirrors lib/identity.ts: an interface, a clearly-labeled dev
// mock, and a selector that THROWS on any unrecognized provider name so a
// future real vendor can never silently fall back to the mock.
// ---------------------------------------------------------------------------

export const OTP_TTL_MS = 10 * 60 * 1000;

export interface PhoneOtpProvider {
  name: string;
  /** Deliver `code` to `phone`. The mock delivers nothing — the dev UI shows it. */
  sendOtp(phone: string, code: string): Promise<void>;
}

/** Six digits, zero-padded, as a string so leading zeros survive. */
export function generateOtpCode(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

/** Strips formatting, keeping a leading "+" so international numbers round-trip. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^0-9]/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function isOtpValid(
  stored: { code: string | null; expiresAt: Date | null },
  submitted: string,
  now: Date = new Date()
): boolean {
  if (!stored.code || !stored.expiresAt) return false;
  if (stored.expiresAt.getTime() <= now.getTime()) return false;
  const candidate = submitted.trim();
  if (candidate.length === 0) return false;
  return stored.code === candidate;
}

const mockProvider: PhoneOtpProvider = {
  name: "mock",
  async sendOtp() {
    // Intentionally a no-op. The /verify-phone page renders the code directly
    // when this provider is active; nothing is ever texted.
  },
};

export function getPhoneOtpProvider(): PhoneOtpProvider {
  const configured = process.env.PHONE_OTP_PROVIDER ?? "mock";
  if (configured !== "mock") {
    throw new Error(`Phone OTP provider "${configured}" is not implemented yet.`);
  }
  return mockProvider;
}

/**
 * Whether the dev mock's code may be shown on screen.
 *
 * The mock displays the OTP to anyone who knows the email address, which also
 * makes the page an account-enumeration oracle. Fine locally and on previews;
 * refused in production. Mirrors isIdentityMockEnabled() in lib/identity.ts.
 * Note this gates only the DISCLOSURE — getPhoneOtpProvider() still returns the
 * mock so registration keeps working; it simply delivers nothing.
 */
export function isPhoneOtpMockEnabled(): boolean {
  return getPhoneOtpProvider().name === "mock" && process.env.VERCEL_ENV !== "production";
}
