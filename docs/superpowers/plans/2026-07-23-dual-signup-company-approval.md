# Dual Signup Paths + Manual Company Approval — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split signup into a self-serve individual path (email + phone OTP) and a founder-reviewed company path where no account exists until manual approval.

**Architecture:** Individuals register as they do today plus a phone number, and a 6-digit OTP stored on the user row gates login alongside the existing email gate. Companies submit a `CompanyApplication` row with no password; the founder approves it from an env-gated `/admin/companies` dashboard, which creates the `User` and emails a set-password link. Phone delivery sits behind a provider seam (mock now, Twilio later) copied structurally from the existing `lib/identity.ts`.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Prisma 7 + Neon, NextAuth v5, Zod 4, Vitest, Resend, `@upstash/ratelimit`.

**Spec:** `docs/superpowers/specs/2026-07-23-dual-signup-company-approval-design.md`

## Global Constraints

- **Read the Next.js guide before writing route/page code.** Per `AGENTS.md`: this Next.js version has breaking changes vs. training data. Relevant guides live in `node_modules/next/dist/docs/`. In particular `params` and `searchParams` are **Promises** and must be awaited (see `app/(auth)/verify-email/page.tsx` for the existing pattern).
- **Prisma quirk:** `npx prisma db push` does **not** regenerate the client in this project. Always follow it with `npx prisma generate`.
- **Styling:** all new pages use the early-2000s inline-style theme (no Tailwind). Copy the exact style objects from `app/(auth)/sign-up/page.tsx` and `app/(main)/verify/mock/mock-form.tsx`. Palette: header/primary `#3b5998`, border `#c8d0e0`, input border `#bdc7d8`, error bg `#fff3f3` / border `#f5c6cb` / text `#c00`, muted text `#666`, dev-mock amber bg `#fff8e1` / border `#ffb300`.
- **Tests are pure-function only.** This codebase has no DB-integration tests (see `lib/identity.test.ts`, `lib/matching.test.ts`). Extract logic into pure functions and test those. Do not add a test DB.
- **Every authenticated write route** calls `getWriteRateLimit().limit(session.user.id)` and returns 429 on failure. Every unauthenticated POST route rate-limits by IP from `request.headers.get("x-forwarded-for") ?? "unknown"`.
- **Gates before every commit:** `npm test` (all passing), `npx tsc --noEmit` (exit 0 — note `.next/types/*.d 4.ts` duplicate-identifier warnings are stale build artifacts, not failures; `rm -rf .next` clears them), `npm run build`.

## Documented v1 boundaries (deliberate, do not "fix")

- **The phone gate applies only to credentials (email/password) signups.** OAuth users (Google/Apple) never reach `authorize()` in `lib/auth.ts` — they authenticate through the NextAuth adapter — and never supply a phone. They remain gated by their provider's own verification. Do **not** add a `signIn` callback to force OAuth users through phone verification; that would lock out existing OAuth accounts with no recovery path.
- **The mock OTP code is displayed on-screen to anyone who knows the email address.** This is acceptable only because `PHONE_OTP_PROVIDER=mock` is a development stand-in. The UI must say so plainly. Real SMS is a follow-up.

## File Structure

**Created:**
- `lib/phone-otp.ts` — provider seam + pure OTP helpers (`generateOtpCode`, `isOtpValid`, `normalizePhone`, `OTP_TTL_MS`).
- `lib/phone-otp.test.ts` — unit tests for the pure helpers.
- `lib/admin.ts` — `isAdminEmail` (pure) + `requireAdmin` (session-aware gate).
- `lib/admin.test.ts` — unit tests for `isAdminEmail`.
- `scripts/backfill-phone-verified.mjs` — one-off: marks all pre-existing users phone-verified.
- `app/(auth)/sign-up/individual/page.tsx` — the current signup form, relocated, plus a phone field.
- `app/(auth)/sign-up/company/page.tsx` — company application form.
- `app/(auth)/sign-up/company/submitted/page.tsx` — post-submission confirmation.
- `app/(auth)/verify-phone/page.tsx` + `verify-phone-form.tsx` — OTP entry (server shell + client form).
- `app/(auth)/company/set-password/page.tsx` + `set-password-form.tsx` — token-gated password creation.
- `app/api/auth/verify-phone/route.ts` — OTP check.
- `app/api/auth/resend-phone-otp/route.ts` — regenerate + resend.
- `app/api/company-applications/route.ts` — public application submission.
- `app/api/admin/company-applications/[id]/route.ts` — approve/reject.
- `app/api/company/set-password/route.ts` — consume token, set password.
- `app/admin/companies/page.tsx` + `admin-client.tsx` — review dashboard.

**Modified:**
- `prisma/schema.prisma` — `User` phone fields; `CompanyApplication` model + `CompanyApplicationStatus` enum.
- `lib/validations.ts` — `signUpSchema` gains `phone`; add `verifyPhoneSchema`, `companyApplicationSchema`, `setPasswordSchema`; delete dead `occupationSchema`.
- `lib/rate-limit.ts` — add `getPhoneOtpRateLimit`, `getCompanyApplicationRateLimit`.
- `lib/email.ts` — add three company-lifecycle emails.
- `lib/auth.ts` — block credentials login until `phoneVerified`.
- `app/(auth)/sign-up/page.tsx` — becomes the two-way chooser.
- `app/api/auth/register/route.ts` — persist phone, issue OTP.
- `app/onboarding/occupation/page.tsx` + `app/api/user/onboarding/occupation/route.ts` — remove the EMPLOYER self-declaration path.

---

### Task 1: Data model, phone-OTP seam, and admin gate

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `lib/phone-otp.ts`, `lib/phone-otp.test.ts`, `lib/admin.ts`, `lib/admin.test.ts`, `scripts/backfill-phone-verified.mjs`
- Modify: `lib/rate-limit.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `PhoneOtpProvider { name: string; sendOtp(phone: string, code: string): Promise<void> }`
  - `getPhoneOtpProvider(): PhoneOtpProvider`
  - `generateOtpCode(): string` (6 digits)
  - `isOtpValid(stored: { code: string | null; expiresAt: Date | null }, submitted: string, now?: Date): boolean`
  - `normalizePhone(raw: string): string`
  - `OTP_TTL_MS: number`
  - `isAdminEmail(email: string | null | undefined, allowList: string | undefined): boolean`
  - `requireAdmin(): Promise<boolean>`
  - `getPhoneOtpRateLimit()`, `getCompanyApplicationRateLimit()`
  - Prisma: `User.phone`, `User.phoneVerified`, `User.phoneOtpCode`, `User.phoneOtpExpiresAt`; `CompanyApplication` model; `CompanyApplicationStatus` enum.

- [ ] **Step 1: Write the failing tests for the pure OTP helpers**

Create `lib/phone-otp.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateOtpCode, isOtpValid, normalizePhone, OTP_TTL_MS } from "./phone-otp";

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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/phone-otp.test.ts`
Expected: FAIL — `Failed to resolve import "./phone-otp"`.

- [ ] **Step 3: Implement `lib/phone-otp.ts`**

```typescript
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/phone-otp.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Write the failing test for the admin gate**

Create `lib/admin.test.ts`:

```typescript
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
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run lib/admin.test.ts`
Expected: FAIL — `Failed to resolve import "./admin"`.

- [ ] **Step 7: Implement `lib/admin.ts`**

```typescript
import { auth } from "@/lib/auth";

// Admin access is an env-var allow-list, not a DB role: there is exactly one
// reviewer today and a role system would be unused machinery. Fails closed —
// an unset or empty ADMIN_EMAILS grants nobody access.
export function isAdminEmail(
  email: string | null | undefined,
  allowList: string | undefined
): boolean {
  if (!email) return false;
  if (!allowList) return false;
  const allowed = allowList
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
  return allowed.includes(email.trim().toLowerCase());
}

/** True when the current session belongs to an admin. */
export async function requireAdmin(): Promise<boolean> {
  const session = await auth();
  return isAdminEmail(session?.user?.email, process.env.ADMIN_EMAILS);
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run lib/admin.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 9: Add the two rate limiters**

In `lib/rate-limit.ts`, append:

```typescript
// Brute-force guard on 6-digit OTP entry. Keyed by email, not IP, so one
// attacker cannot burn a victim's budget from many addresses.
export function getPhoneOtpRateLimit() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "15 m"),
    prefix: "ratelimit:phoneotp",
  });
}

// Company applications are reviewed by hand — a low IP cap is plenty.
export function getCompanyApplicationRateLimit() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(3, "1 d"),
    prefix: "ratelimit:companyapp",
  });
}
```

- [ ] **Step 10: Extend the Prisma schema**

In `prisma/schema.prisma`, add these four fields to `model User`, directly beneath the existing `idVerified` line:

```prisma
  phone              String?
  phoneVerified      Boolean   @default(false)
  phoneOtpCode       String?
  phoneOtpExpiresAt  DateTime?
```

Then append to the end of the file:

```prisma
enum CompanyApplicationStatus {
  PENDING
  APPROVED
  REJECTED
}

// Intentionally has NO relation to User: the whole point of the approval flow
// is that no User exists until the founder approves. Linked only by email.
model CompanyApplication {
  id                      String                   @id @default(cuid())
  companyName             String
  contactName             String
  workEmail               String
  website                 String?
  description             String?
  status                  CompanyApplicationStatus @default(PENDING)
  setPasswordToken        String?                  @unique
  setPasswordTokenExpires DateTime?
  createdAt               DateTime                 @default(now())
  decidedAt               DateTime?

  @@index([status])
  @@index([workEmail])
}
```

- [ ] **Step 11: Push the schema and regenerate the client**

Run: `npx prisma db push && npx prisma generate`
Expected: "Your database is now in sync with your Prisma schema" followed by "Generated Prisma Client".

- [ ] **Step 12: Write and run the backfill script**

Every existing user defaults to `phoneVerified: false`. Task 3 makes that value block login, so without this backfill the next deploy locks out every current account.

Create `scripts/backfill-phone-verified.mjs`:

```javascript
// One-off: existing accounts predate phone verification and must not be locked
// out when the login gate lands. Safe to re-run — it only touches users with
// no phone on file, so genuinely unverified new signups are never affected.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const result = await prisma.user.updateMany({
  where: { phone: null, phoneVerified: false },
  data: { phoneVerified: true },
});

console.log(`Backfilled ${result.count} pre-existing user(s) as phone-verified.`);
await prisma.$disconnect();
```

Run: `node scripts/backfill-phone-verified.mjs`
Expected: `Backfilled N pre-existing user(s) as phone-verified.`

- [ ] **Step 13: Run the full gates**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all tests pass (57 existing + 17 new = 74), tsc exit 0, build succeeds.

- [ ] **Step 14: Commit**

```bash
git add prisma/schema.prisma lib/phone-otp.ts lib/phone-otp.test.ts lib/admin.ts lib/admin.test.ts lib/rate-limit.ts scripts/backfill-phone-verified.mjs
git commit -m "feat: add phone-OTP seam, admin gate, and company-application model"
```

---

### Task 2: Split the signup entry into individual and company paths

**Files:**
- Modify: `app/(auth)/sign-up/page.tsx` (becomes the chooser)
- Create: `app/(auth)/sign-up/individual/page.tsx`
- Modify: `lib/validations.ts`
- Modify: `app/api/auth/register/route.ts`

**Interfaces:**
- Consumes: `generateOtpCode`, `normalizePhone`, `getPhoneOtpProvider`, `OTP_TTL_MS` from `lib/phone-otp.ts` (Task 1).
- Produces: `/sign-up/individual` route; `signUpSchema` with a required `phone` field; register route that persists `phone` + issues an OTP and redirects to `/verify-phone?email=...`.

- [ ] **Step 1: Add `phone` to `signUpSchema` and delete the dead `occupationSchema`**

In `lib/validations.ts`, inside `signUpSchema`'s object, add `phone` immediately after `email`:

```typescript
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s\-().]{7,20}$/, "Please enter a valid phone number"),
```

Then delete the entire `occupationSchema` export (lines 35–49). It is dead code — `app/api/user/onboarding/occupation/route.ts` declares its own inline schema and nothing imports `occupationSchema`. Verify with:

Run: `grep -rn "occupationSchema" --include="*.ts" --include="*.tsx" app lib`
Expected: no output.

- [ ] **Step 2: Move the existing signup form to `/sign-up/individual`**

```bash
mkdir -p "app/(auth)/sign-up/individual"
git mv "app/(auth)/sign-up/page.tsx" "app/(auth)/sign-up/individual/page.tsx"
```

- [ ] **Step 3: Add the phone field to the relocated form**

In `app/(auth)/sign-up/individual/page.tsx`:

Change the initial form state to include `phone`:

```typescript
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "" });
```

Insert this field block immediately after the closing `</div>` of the email field and before the password field:

```tsx
        <div style={s.field}>
          <label style={s.label}>Phone number</label>
          <input style={errors.phone ? s.inputError : s.input} type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          {errors.phone?.[0] && <div style={s.fieldError}>{errors.phone[0]}</div>}
          <div style={{ fontSize: "10px", color: "#999", marginTop: "2px" }}>We&apos;ll text you a 6-digit code to confirm it&apos;s you.</div>
        </div>
```

Change the post-registration redirect to send the user to phone verification instead of the email notice:

```typescript
      router.push("/verify-phone?email=" + encodeURIComponent(form.email));
```

Update the page heading to name the audience:

```tsx
      <div style={s.title}>Create your account</div>
      <p style={{ fontSize: "11px", color: "#666", margin: "-10px 0 14px" }}>
        For students and individuals looking for opportunities.
      </p>
```

- [ ] **Step 4: Create the chooser at `/sign-up`**

Create `app/(auth)/sign-up/page.tsx`:

```tsx
import Link from "next/link";

const card: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  border: "1px solid #c8d0e0",
  borderRadius: "2px",
  padding: "14px",
  marginBottom: "10px",
  background: "#fff",
};

export default function SignUpChooserPage() {
  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", marginBottom: "4px" }}>
        Join (name)
      </div>
      <p style={{ fontSize: "11px", color: "#666", margin: "0 0 16px" }}>
        Pick the option that describes you.
      </p>

      <Link href="/sign-up/individual" style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "28px" }}>🎓</span>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "bold", color: "#3b5998" }}>
              I&apos;m looking for opportunities
            </div>
            <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>
              Students and individuals. Sign up in a minute.
            </div>
          </div>
        </div>
      </Link>

      <Link href="/sign-up/company" style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "28px" }}>🏢</span>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "bold", color: "#3b5998" }}>
              I&apos;m hiring or posting opportunities
            </div>
            <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>
              Companies and organizations. Applications are reviewed by hand.
            </div>
          </div>
        </div>
      </Link>

      <div style={{ marginTop: "14px", fontSize: "11px", color: "#666", textAlign: "center", borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
        Already have an account? <a href="/sign-in" style={{ color: "#3b5998" }}>Sign in</a>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Issue an OTP in the register route**

In `app/api/auth/register/route.ts`:

Add to the imports:

```typescript
import { generateOtpCode, normalizePhone, getPhoneOtpProvider, OTP_TTL_MS } from "@/lib/phone-otp";
```

Change the destructure to pull `phone`:

```typescript
  const { firstName, lastName, email, phone, password } = parsed.data;
```

Replace the `db.user.create({...})` call with one that stores the phone and OTP, capturing the code so it can be handed to the provider:

```typescript
  const otpCode = generateOtpCode();

  await db.user.create({
    data: {
      email,
      passwordHash,
      name: `${firstName.trim()} ${lastName.trim()}`,
      hasEduEmail: email.toLowerCase().endsWith(".edu"),
      phone: normalizePhone(phone),
      phoneOtpCode: otpCode,
      phoneOtpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  await getPhoneOtpProvider().sendOtp(normalizePhone(phone), otpCode);
```

Leave the existing email-verification token block and `sendVerificationEmail` call exactly as they are — both confirmations run in parallel.

- [ ] **Step 6: Verify the build compiles and existing tests still pass**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: 74 tests pass, tsc exit 0, build lists `/sign-up` and `/sign-up/individual` as routes.

- [ ] **Step 7: Commit**

```bash
git add "app/(auth)/sign-up" lib/validations.ts app/api/auth/register/route.ts
git commit -m "feat: split signup into individual and company entry paths"
```

---

### Task 3: Phone verification flow and login gate

**Files:**
- Create: `app/(auth)/verify-phone/page.tsx`, `app/(auth)/verify-phone/verify-phone-form.tsx`
- Create: `app/api/auth/verify-phone/route.ts`, `app/api/auth/resend-phone-otp/route.ts`
- Modify: `lib/validations.ts`, `lib/auth.ts`

**Interfaces:**
- Consumes: `isOtpValid`, `generateOtpCode`, `getPhoneOtpProvider`, `OTP_TTL_MS` from `lib/phone-otp.ts`; `getPhoneOtpRateLimit` from `lib/rate-limit.ts` (Task 1).
- Produces: `/verify-phone?email=...` route; `POST /api/auth/verify-phone` `{ email, code }` → `{ success: true }`; `POST /api/auth/resend-phone-otp` `{ email }` → `{ success: true }`; credentials login blocked until `phoneVerified`.

- [ ] **Step 1: Add `verifyPhoneSchema` to `lib/validations.ts`**

```typescript
export const verifyPhoneSchema = z.object({
  email: z.string().email(),
  code: z.string().trim().regex(/^[0-9]{6}$/, "Enter the 6-digit code"),
});

export const resendPhoneOtpSchema = z.object({
  email: z.string().email(),
});
```

- [ ] **Step 2: Create the OTP verification route**

Create `app/api/auth/verify-phone/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPhoneSchema } from "@/lib/validations";
import { isOtpValid } from "@/lib/phone-otp";
import { getPhoneOtpRateLimit } from "@/lib/rate-limit";

// Unauthenticated by necessity: the user cannot sign in until this succeeds.
// The 6-digit code is the secret; the rate limiter is what makes it safe.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = verifyPhoneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { email, code } = parsed.data;

  const { success } = await getPhoneOtpRateLimit().limit(email.toLowerCase());
  if (!success) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, phoneVerified: true, phoneOtpCode: true, phoneOtpExpiresAt: true },
  });

  // Same generic error for "no such user" and "wrong code" so this endpoint
  // cannot be used to enumerate which email addresses have accounts.
  if (!user || !isOtpValid({ code: user.phoneOtpCode, expiresAt: user.phoneOtpExpiresAt }, code)) {
    return NextResponse.json({ error: "That code is incorrect or has expired." }, { status: 400 });
  }

  await db.user.update({
    where: { id: user.id },
    data: { phoneVerified: true, phoneOtpCode: null, phoneOtpExpiresAt: null },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create the resend route**

Create `app/api/auth/resend-phone-otp/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resendPhoneOtpSchema } from "@/lib/validations";
import { generateOtpCode, getPhoneOtpProvider, OTP_TTL_MS } from "@/lib/phone-otp";
import { getPhoneOtpRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = resendPhoneOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { email } = parsed.data;

  const { success } = await getPhoneOtpRateLimit().limit(`resend:${email.toLowerCase()}`);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, phone: true, phoneVerified: true },
  });

  // Always report success: a differing response would reveal which emails exist.
  if (user && user.phone && !user.phoneVerified) {
    const otpCode = generateOtpCode();
    await db.user.update({
      where: { id: user.id },
      data: { phoneOtpCode: otpCode, phoneOtpExpiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });
    await getPhoneOtpProvider().sendOtp(user.phone, otpCode);
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Create the verification page shell**

Create `app/(auth)/verify-phone/page.tsx`. It is a server component so it can read the mock code straight from the DB:

```tsx
import { db } from "@/lib/db";
import { getPhoneOtpProvider } from "@/lib/phone-otp";
import VerifyPhoneForm from "./verify-phone-form";

export default async function VerifyPhonePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const isMock = getPhoneOtpProvider().name === "mock";

  let mockCode: string | null = null;
  if (isMock && email) {
    const user = await db.user.findUnique({
      where: { email },
      select: { phoneOtpCode: true },
    });
    mockCode = user?.phoneOtpCode ?? null;
  }

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", marginBottom: "4px" }}>
        Confirm your phone
      </div>
      <p style={{ fontSize: "11px", color: "#666", margin: "0 0 14px" }}>
        Enter the 6-digit code we sent you. It expires in 10 minutes.
      </p>

      {isMock && (
        <div style={{ background: "#fff8e1", border: "1px solid #ffb300", borderRadius: "2px", padding: "8px 10px", marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: "bold", color: "#7a5c00", marginBottom: "3px" }}>
            DEV MOCK — no text message was sent
          </div>
          <div style={{ fontSize: "11px", color: "#7a5c00" }}>
            {mockCode
              ? <>Your code is <strong style={{ fontSize: "14px", letterSpacing: "1px" }}>{mockCode}</strong>. Anyone who knows this email address can see it — this stand-in must be replaced with real SMS before launch.</>
              : <>No pending code for this address.</>}
          </div>
        </div>
      )}

      {email ? (
        <VerifyPhoneForm email={email} />
      ) : (
        <p style={{ fontSize: "12px", color: "#c00" }}>
          Missing email address. <a href="/sign-up/individual" style={{ color: "#3b5998" }}>Start over</a>.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create the client form**

Create `app/(auth)/verify-phone/verify-phone-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #bdc7d8",
  padding: "6px 7px",
  fontSize: "18px",
  letterSpacing: "4px",
  textAlign: "center",
  borderRadius: "2px",
  marginBottom: "10px",
};

export default function VerifyPhoneForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/verify-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "That code is incorrect or has expired.");
        return;
      }
      router.push("/verify-email?email=" + encodeURIComponent(email));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    setNotice("");
    await fetch("/api/auth/resend-phone-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setNotice("If that account is awaiting confirmation, a new code is on its way.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div style={{ background: "#fff3f3", border: "1px solid #f5c6cb", color: "#c00", fontSize: "11px", padding: "6px 8px", borderRadius: "2px", marginBottom: "10px" }}>
          {error}
        </div>
      )}
      {notice && (
        <div style={{ background: "#f0f7ff", border: "1px solid #c8d0e0", color: "#3b5998", fontSize: "11px", padding: "6px 8px", borderRadius: "2px", marginBottom: "10px" }}>
          {notice}
        </div>
      )}

      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        style={inputStyle}
      />

      <button
        type="submit"
        disabled={isLoading || code.length !== 6}
        style={{ width: "100%", background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "6px", fontSize: "13px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer", opacity: code.length !== 6 ? 0.6 : 1 }}
      >
        {isLoading ? "Checking..." : "Confirm phone"}
      </button>

      <button
        type="button"
        onClick={handleResend}
        style={{ width: "100%", marginTop: "8px", background: "#fff", color: "#3b5998", border: "1px solid #c8d0e0", padding: "6px", fontSize: "12px", borderRadius: "2px", cursor: "pointer" }}
      >
        Send a new code
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Add the login gate**

In `lib/auth.ts`, inside the `Credentials` provider's `authorize`, add one line directly beneath the existing `emailVerified` check:

```typescript
        if (!user.emailVerified) return null;
        if (!user.phoneVerified) return null;
```

- [ ] **Step 7: Run the full gates**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: 74 tests pass, tsc exit 0, build lists `/verify-phone`.

- [ ] **Step 8: Commit**

```bash
git add "app/(auth)/verify-phone" app/api/auth/verify-phone app/api/auth/resend-phone-otp lib/validations.ts lib/auth.ts
git commit -m "feat: add phone OTP verification flow and login gate"
```

---

### Task 4: Company application submission

**Files:**
- Create: `app/(auth)/sign-up/company/page.tsx`, `app/(auth)/sign-up/company/submitted/page.tsx`
- Create: `app/api/company-applications/route.ts`
- Modify: `lib/validations.ts`, `lib/email.ts`
- Modify: `app/onboarding/occupation/page.tsx`, `app/api/user/onboarding/occupation/route.ts`

**Interfaces:**
- Consumes: `getCompanyApplicationRateLimit` from `lib/rate-limit.ts` (Task 1); the `/sign-up/company` link created by the chooser (Task 2).
- Produces: `companyApplicationSchema`; `POST /api/company-applications` → `{ success: true }`; `sendCompanyApplicationNotification(adminEmail, application)` in `lib/email.ts`.

- [ ] **Step 1: Add `companyApplicationSchema` to `lib/validations.ts`**

```typescript
export const companyApplicationSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required").max(200),
  contactName: z.string().trim().min(2, "Your name is required").max(100),
  workEmail: z.string().trim().email("Please enter a valid work email address"),
  website: z.string().trim().url("Website must be a valid link").max(300).optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type CompanyApplicationInput = z.infer<typeof companyApplicationSchema>;
```

- [ ] **Step 2: Add the founder notification email**

Append to `lib/email.ts`:

```typescript
export async function sendCompanyApplicationNotification(
  adminEmail: string,
  application: {
    id: string;
    companyName: string;
    contactName: string;
    workEmail: string;
    website: string | null;
    description: string | null;
  }
): Promise<void> {
  const reviewUrl = `${process.env.NEXTAUTH_URL}/admin/companies`;

  await getResend().emails.send({
    from: process.env.EMAIL_FROM!,
    to: adminEmail,
    subject: `New company application: ${application.companyName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
        <h2>New company application</h2>
        <p><strong>Company:</strong> ${application.companyName}</p>
        <p><strong>Contact:</strong> ${application.contactName} &lt;${application.workEmail}&gt;</p>
        <p><strong>Website:</strong> ${application.website ?? "—"}</p>
        <p><strong>What they're hiring for:</strong><br/>${application.description ?? "—"}</p>
        <a href="${reviewUrl}"
           style="display:inline-block;padding:12px 24px;background:#3b5998;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">
          Review applications
        </a>
      </div>
    `,
  });
}
```

- [ ] **Step 3: Create the submission route**

Create `app/api/company-applications/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companyApplicationSchema } from "@/lib/validations";
import { sendCompanyApplicationNotification } from "@/lib/email";
import { getCompanyApplicationRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await getCompanyApplicationRateLimit().limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = companyApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { companyName, contactName, workEmail, website, description } = parsed.data;

  const existingUser = await db.user.findUnique({ where: { email: workEmail } });
  if (existingUser) {
    return NextResponse.json(
      { error: { workEmail: ["An account already exists with this email."] } },
      { status: 409 }
    );
  }

  const existingApplication = await db.companyApplication.findFirst({
    where: { workEmail, status: { in: ["PENDING", "APPROVED"] } },
  });
  if (existingApplication) {
    return NextResponse.json(
      { error: { workEmail: ["You already have an application on file."] } },
      { status: 409 }
    );
  }

  const application = await db.companyApplication.create({
    data: {
      companyName,
      contactName,
      workEmail,
      website: website || null,
      description: description || null,
    },
  });

  // The founder allow-list doubles as the notification list. A missing
  // ADMIN_EMAILS must not lose the application — it is already saved above.
  const adminEmail = (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim();
  if (adminEmail) {
    await sendCompanyApplicationNotification(adminEmail, application);
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
```

- [ ] **Step 4: Create the company application form**

Create `app/(auth)/sign-up/company/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { companyApplicationSchema } from "@/lib/validations";

const s = {
  label: { display: "block" as const, fontSize: "12px", fontWeight: "bold" as const, color: "#333", marginBottom: "3px" },
  input: { width: "100%", boxSizing: "border-box" as const, border: "1px solid #bdc7d8", padding: "5px 7px", fontSize: "13px", borderRadius: "2px", outline: "none" },
  inputError: { width: "100%", boxSizing: "border-box" as const, border: "1px solid #c00", padding: "5px 7px", fontSize: "13px", borderRadius: "2px", outline: "none" },
  fieldError: { color: "#c00", fontSize: "11px", marginTop: "2px" },
  field: { marginBottom: "10px" },
};

export default function CompanySignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({ companyName: "", contactName: "", workEmail: "", website: "", description: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    const parsed = companyApplicationSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setIsLoading(true);
    try {
      const res = await fetch("/api/company-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.error === "object") setErrors(data.error);
        else setServerError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/sign-up/company/submitted");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", marginBottom: "4px" }}>
        Apply to post opportunities
      </div>
      <p style={{ fontSize: "11px", color: "#666", margin: "0 0 14px" }}>
        We review every company by hand while we&apos;re getting started. Tell us
        about you and we&apos;ll email you once you&apos;re approved.
      </p>

      {serverError && (
        <div style={{ background: "#fff3f3", border: "1px solid #f5c6cb", color: "#c00", fontSize: "11px", padding: "6px 8px", borderRadius: "2px", marginBottom: "8px" }}>
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={s.field}>
          <label style={s.label}>Company name</label>
          <input style={errors.companyName ? s.inputError : s.input} value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} />
          {errors.companyName?.[0] && <div style={s.fieldError}>{errors.companyName[0]}</div>}
        </div>
        <div style={s.field}>
          <label style={s.label}>Your name</label>
          <input style={errors.contactName ? s.inputError : s.input} autoComplete="name" value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} />
          {errors.contactName?.[0] && <div style={s.fieldError}>{errors.contactName[0]}</div>}
        </div>
        <div style={s.field}>
          <label style={s.label}>Work email</label>
          <input style={errors.workEmail ? s.inputError : s.input} type="email" autoComplete="email" value={form.workEmail} onChange={(e) => setForm((f) => ({ ...f, workEmail: e.target.value }))} />
          {errors.workEmail?.[0] && <div style={s.fieldError}>{errors.workEmail[0]}</div>}
        </div>
        <div style={s.field}>
          <label style={s.label}>Website <span style={{ fontWeight: "normal", color: "#666" }}>(optional)</span></label>
          <input style={errors.website ? s.inputError : s.input} placeholder="https://" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
          {errors.website?.[0] && <div style={s.fieldError}>{errors.website[0]}</div>}
        </div>
        <div style={s.field}>
          <label style={s.label}>What are you hiring for? <span style={{ fontWeight: "normal", color: "#666" }}>(optional)</span></label>
          <textarea rows={4} style={{ ...s.input, resize: "vertical" }} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          {errors.description?.[0] && <div style={s.fieldError}>{errors.description[0]}</div>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          style={{ width: "100%", background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "6px", fontSize: "13px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer", marginTop: "4px" }}
        >
          {isLoading ? "Submitting..." : "Submit application"}
        </button>
        <p style={{ fontSize: "10px", color: "#999", marginTop: "6px", textAlign: "center" }}>
          You&apos;ll set a password after you&apos;re approved.
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Create the confirmation page**

Create `app/(auth)/sign-up/company/submitted/page.tsx`:

```tsx
export default function CompanyApplicationSubmittedPage() {
  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif", textAlign: "center" }}>
      <div style={{ fontSize: "40px", marginBottom: "10px" }}>📨</div>
      <div style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", marginBottom: "6px" }}>
        Application received
      </div>
      <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px" }}>
        We review every company by hand. You&apos;ll get an email at the address
        you gave us once we&apos;ve had a look.
      </p>
      <p style={{ fontSize: "11px", color: "#999", margin: "0 0 16px" }}>
        Approved companies get a link to set a password and start posting.
      </p>
      <a href="/" style={{ fontSize: "12px", color: "#3b5998" }}>Back to home</a>
    </div>
  );
}
```

- [ ] **Step 6: Remove the EMPLOYER self-declaration from onboarding**

This is the step that actually closes the bypass — without it, any individual can still self-declare as an employer during onboarding and post immediately, making the approval gate decorative.

In `app/onboarding/occupation/page.tsx`, delete the `EMPLOYER` entry from the `OCCUPATIONS` array so only `STUDENT` and `OTHER` remain:

```typescript
const OCCUPATIONS = [
  {
    value: "STUDENT",
    icon: "🎓",
    title: "Student",
    description: "Looking for jobs, internships or programs",
  },
  {
    value: "OTHER",
    icon: "👤",
    title: "Other",
    description: "Something else",
  },
];
```

Then delete the now-unreachable company-name state and UI from the same file: remove the `companyName` and `companyError` `useState` declarations, the `if (selected === "EMPLOYER" && !companyName.trim())` guard and the `setCompanyError("")` line in `handleSubmit`, the `companyName` property from the fetch body (leaving `body: JSON.stringify({ occupationType: selected })`), and the entire `{selected === "EMPLOYER" && ( ... )}` JSX block.

In `app/api/user/onboarding/occupation/route.ts`, narrow the schema and drop the company branch:

```typescript
const schema = z.object({
  occupationType: z.enum(["STUDENT", "OTHER"]),
});
```

```typescript
  const { occupationType } = parsed.data;

  // EMPLOYER is deliberately not reachable here: company accounts are created
  // only by founder approval in /admin/companies.
  const dbOccupationType =
    occupationType === "STUDENT" ? OccupationType.STUDENT_HS : OccupationType.OTHER;

  await db.user.update({
    where: { id: session.user.id },
    data: { occupationType: dbOccupationType },
  });
```

- [ ] **Step 7: Run the full gates**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: 74 tests pass, tsc exit 0, build lists `/sign-up/company` and `/sign-up/company/submitted`.

- [ ] **Step 8: Commit**

```bash
git add "app/(auth)/sign-up/company" app/api/company-applications lib/validations.ts lib/email.ts app/onboarding/occupation/page.tsx app/api/user/onboarding/occupation/route.ts
git commit -m "feat: add company application submission and close employer self-declaration"
```

---

### Task 5: Admin review dashboard

**Files:**
- Create: `app/admin/companies/page.tsx`, `app/admin/companies/admin-client.tsx`
- Create: `app/api/admin/company-applications/[id]/route.ts`
- Modify: `lib/email.ts`

**Interfaces:**
- Consumes: `requireAdmin` from `lib/admin.ts`, `getWriteRateLimit` from `lib/rate-limit.ts` (Task 1); the `CompanyApplication` model (Task 1).
- Produces: `/admin/companies` route; `PATCH /api/admin/company-applications/[id]` with body `{ action: "approve" | "reject" }` → `{ success: true }`; `sendCompanyApprovedEmail(to, setPasswordUrl)` and `sendCompanyRejectedEmail(to, companyName)` in `lib/email.ts`.

- [ ] **Step 1: Add the applicant-facing emails**

Append to `lib/email.ts`:

```typescript
export async function sendCompanyApprovedEmail(
  to: string,
  setPasswordUrl: string
): Promise<void> {
  await getResend().emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: "You're approved — set your password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>You're approved</h2>
        <p>Your company has been approved to post opportunities. Set a password to finish setting up your account. This link expires in 24 hours.</p>
        <a href="${setPasswordUrl}"
           style="display:inline-block;padding:12px 24px;background:#3b5998;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">
          Set your password
        </a>
      </div>
    `,
  });
}

export async function sendCompanyRejectedEmail(
  to: string,
  companyName: string
): Promise<void> {
  await getResend().emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: "About your application",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Thanks for your interest</h2>
        <p>We're not able to approve ${companyName} to post opportunities at this time. We're onboarding companies gradually while we get started, so this may change.</p>
        <p style="color:#64748b;font-size:14px;">Thanks for taking the time to apply.</p>
      </div>
    `,
  });
}
```

- [ ] **Step 2: Create the approve/reject route**

Create `app/api/admin/company-applications/[id]/route.ts`. Note `params` is a Promise in this Next.js version and must be awaited:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { getWriteRateLimit } from "@/lib/rate-limit";
import { sendCompanyApprovedEmail, sendCompanyRejectedEmail } from "@/lib/email";
import { OccupationType } from "@prisma/client";

const schema = z.object({ action: z.enum(["approve", "reject"]) });

const SET_PASSWORD_TTL_MS = 24 * 60 * 60 * 1000;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  const { success } = await getWriteRateLimit().limit(session!.user!.id!);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const application = await db.companyApplication.findUnique({ where: { id } });
  if (!application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }
  if (application.status !== "PENDING") {
    return NextResponse.json({ error: "This application has already been decided." }, { status: 400 });
  }

  if (parsed.data.action === "reject") {
    await db.companyApplication.update({
      where: { id },
      data: { status: "REJECTED", decidedAt: new Date() },
    });
    await sendCompanyRejectedEmail(application.workEmail, application.companyName);
    return NextResponse.json({ success: true });
  }

  // Approve: guard against an account appearing between submission and review.
  const existingUser = await db.user.findUnique({ where: { email: application.workEmail } });
  if (existingUser) {
    return NextResponse.json(
      { error: "An account already exists with this email." },
      { status: 409 }
    );
  }

  // phoneVerified is true because the founder's manual review IS this account's
  // trust gate — company accounts never go through phone OTP. emailVerified
  // stays null until they click the set-password link, which proves the address.
  await db.user.create({
    data: {
      email: application.workEmail,
      name: application.contactName,
      companyName: application.companyName,
      occupationType: OccupationType.EMPLOYER,
      phoneVerified: true,
    },
  });

  const token = nanoid(32);
  await db.companyApplication.update({
    where: { id },
    data: {
      status: "APPROVED",
      decidedAt: new Date(),
      setPasswordToken: token,
      setPasswordTokenExpires: new Date(Date.now() + SET_PASSWORD_TTL_MS),
    },
  });

  await sendCompanyApprovedEmail(
    application.workEmail,
    `${process.env.NEXTAUTH_URL}/company/set-password?token=${token}`
  );

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create the dashboard page**

Create `app/admin/companies/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import AdminClient from "./admin-client";

export default async function AdminCompaniesPage() {
  // 404 rather than redirect: a non-admin should not learn this page exists.
  if (!(await requireAdmin())) notFound();

  const applications = await db.companyApplication.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      companyName: true,
      contactName: true,
      workEmail: true,
      website: true,
      description: true,
      status: true,
      createdAt: true,
      decidedAt: true,
    },
  });

  return (
    <AdminClient
      applications={applications.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        decidedAt: a.decidedAt?.toISOString() ?? null,
      }))}
    />
  );
}
```

- [ ] **Step 4: Create the dashboard client component**

Create `app/admin/companies/admin-client.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface AdminApplication {
  id: string;
  companyName: string;
  contactName: string;
  workEmail: string;
  website: string | null;
  description: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  decidedAt: string | null;
}

const STATUS_COLORS: Record<AdminApplication["status"], { bg: string; fg: string }> = {
  PENDING: { bg: "#fff8e1", fg: "#7a5c00" },
  APPROVED: { bg: "#e8f5e9", fg: "#2e7d32" },
  REJECTED: { bg: "#f0f0f0", fg: "#666" },
};

export default function AdminClient({ applications }: { applications: AdminApplication[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const visible = applications.filter((a) => a.status === filter);

  async function decide(id: string, action: "approve" | "reject") {
    setError("");
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/company-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Something went wrong.");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif", maxWidth: "760px", margin: "0 auto", padding: "20px 16px" }}>
      <div style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", marginBottom: "10px" }}>
        Company applications
      </div>

      <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              fontSize: "12px",
              padding: "4px 10px",
              borderRadius: "2px",
              cursor: "pointer",
              border: filter === s ? "1px solid #29487d" : "1px solid #c8d0e0",
              background: filter === s ? "#e8edf5" : "#fff",
              color: "#3b5998",
              fontWeight: filter === s ? "bold" : "normal",
            }}
          >
            {s[0] + s.slice(1).toLowerCase()} ({applications.filter((a) => a.status === s).length})
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: "#fff3f3", border: "1px solid #f5c6cb", color: "#c00", fontSize: "11px", padding: "6px 8px", borderRadius: "2px", marginBottom: "10px" }}>
          {error}
        </div>
      )}

      {visible.length === 0 && (
        <p style={{ fontSize: "12px", color: "#666" }}>Nothing here.</p>
      )}

      {visible.map((a) => (
        <div key={a.id} style={{ border: "1px solid #c8d0e0", borderRadius: "2px", background: "#fff", padding: "12px", marginBottom: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
            <div style={{ fontSize: "14px", fontWeight: "bold", color: "#3b5998" }}>{a.companyName}</div>
            <span style={{ fontSize: "10px", fontWeight: "bold", padding: "1px 6px", borderRadius: "2px", background: STATUS_COLORS[a.status].bg, color: STATUS_COLORS[a.status].fg }}>
              {a.status}
            </span>
          </div>
          <div style={{ fontSize: "12px", color: "#333", marginTop: "4px" }}>
            {a.contactName} — {a.workEmail}
          </div>
          {a.website && (
            <div style={{ fontSize: "12px", marginTop: "2px" }}>
              <a href={a.website} target="_blank" rel="noopener noreferrer" style={{ color: "#3b5998" }}>{a.website}</a>
            </div>
          )}
          {a.description && (
            <p style={{ fontSize: "12px", color: "#444", marginTop: "6px", whiteSpace: "pre-wrap" }}>{a.description}</p>
          )}
          <div style={{ fontSize: "10px", color: "#999", marginTop: "6px" }}>
            Applied {new Date(a.createdAt).toLocaleString()}
            {a.decidedAt && ` · Decided ${new Date(a.decidedAt).toLocaleString()}`}
          </div>

          {a.status === "PENDING" && (
            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <button
                onClick={() => decide(a.id, "approve")}
                disabled={busyId === a.id}
                style={{ background: "#e8f5e9", color: "#2e7d32", border: "1px solid #2e7d32", padding: "5px 12px", fontSize: "12px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer" }}
              >
                {busyId === a.id ? "Working..." : "Approve"}
              </button>
              <button
                onClick={() => decide(a.id, "reject")}
                disabled={busyId === a.id}
                style={{ background: "#f0f0f0", color: "#666", border: "1px solid #bbb", padding: "5px 12px", fontSize: "12px", borderRadius: "2px", cursor: "pointer" }}
              >
                {busyId === a.id ? "Working..." : "Reject"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run the full gates**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: 74 tests pass, tsc exit 0, build lists `/admin/companies`.

- [ ] **Step 6: Commit**

```bash
git add app/admin/companies app/api/admin lib/email.ts
git commit -m "feat: add admin dashboard for reviewing company applications"
```

---

### Task 6: Company set-password flow

**Files:**
- Create: `app/(auth)/company/set-password/page.tsx`, `app/(auth)/company/set-password/set-password-form.tsx`
- Create: `app/api/company/set-password/route.ts`
- Modify: `lib/validations.ts`

**Interfaces:**
- Consumes: the `setPasswordToken` / `setPasswordTokenExpires` fields written at approval (Task 5).
- Produces: `/company/set-password?token=...` route; `POST /api/company/set-password` with body `{ token, password, confirmPassword }` → `{ success: true }`.

- [ ] **Step 1: Add `setPasswordSchema` to `lib/validations.ts`**

Password rules are copied verbatim from `signUpSchema` so both paths enforce the same policy:

```typescript
export const setPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z
      .string()
      .min(10, "Password must be at least 10 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
```

- [ ] **Step 2: Create the set-password route**

Create `app/api/company/set-password/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { setPasswordSchema } from "@/lib/validations";
import { getRegistrationRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await getRegistrationRateLimit().limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = setPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { token, password } = parsed.data;

  const application = await db.companyApplication.findUnique({
    where: { setPasswordToken: token },
  });
  if (
    !application ||
    application.status !== "APPROVED" ||
    !application.setPasswordTokenExpires ||
    application.setPasswordTokenExpires < new Date()
  ) {
    return NextResponse.json({ error: "That link is invalid or has expired." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Clicking this emailed link proves control of the work address, so the
  // email is marked verified here rather than sending a second confirmation.
  await db.user.update({
    where: { email: application.workEmail },
    data: { passwordHash, emailVerified: new Date() },
  });

  // Single-use: clear the token so the link cannot be replayed.
  await db.companyApplication.update({
    where: { id: application.id },
    data: { setPasswordToken: null, setPasswordTokenExpires: null },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create the page shell**

Create `app/(auth)/company/set-password/page.tsx`:

```tsx
import SetPasswordForm from "./set-password-form";

export default async function CompanySetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", marginBottom: "6px" }}>
          Link not valid
        </div>
        <p style={{ fontSize: "12px", color: "#666" }}>
          This link is missing its token. Use the link from your approval email.
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", marginBottom: "4px" }}>
        Set your password
      </div>
      <p style={{ fontSize: "11px", color: "#666", margin: "0 0 14px" }}>
        Your company is approved. Choose a password to finish setting up your account.
      </p>
      <SetPasswordForm token={token} />
    </div>
  );
}
```

- [ ] **Step 4: Create the form**

Create `app/(auth)/company/set-password/set-password-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const s = {
  label: { display: "block" as const, fontSize: "12px", fontWeight: "bold" as const, color: "#333", marginBottom: "3px" },
  input: { width: "100%", boxSizing: "border-box" as const, border: "1px solid #bdc7d8", padding: "5px 7px", fontSize: "13px", borderRadius: "2px", outline: "none" },
  inputError: { width: "100%", boxSizing: "border-box" as const, border: "1px solid #c00", padding: "5px 7px", fontSize: "13px", borderRadius: "2px", outline: "none" },
  fieldError: { color: "#c00", fontSize: "11px", marginTop: "2px" },
  field: { marginBottom: "10px" },
};

export default function SetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    setErrors({});
    setIsLoading(true);
    try {
      const res = await fetch("/api/company/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.error === "object") setErrors(data.error);
        else setServerError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/sign-in");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {serverError && (
        <div style={{ background: "#fff3f3", border: "1px solid #f5c6cb", color: "#c00", fontSize: "11px", padding: "6px 8px", borderRadius: "2px", marginBottom: "8px" }}>
          {serverError}
        </div>
      )}

      <div style={s.field}>
        <label style={s.label}>Password</label>
        <input style={errors.password ? s.inputError : s.input} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {errors.password?.[0] && <div style={s.fieldError}>{errors.password[0]}</div>}
      </div>
      <div style={s.field}>
        <label style={s.label}>Confirm password</label>
        <input style={errors.confirmPassword ? s.inputError : s.input} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        {errors.confirmPassword?.[0] && <div style={s.fieldError}>{errors.confirmPassword[0]}</div>}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        style={{ width: "100%", background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "6px", fontSize: "13px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer", marginTop: "4px" }}
      >
        {isLoading ? "Saving..." : "Set password and continue"}
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Run the full gates**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: 74 tests pass, tsc exit 0, build lists `/company/set-password`.

- [ ] **Step 6: Commit**

```bash
git add "app/(auth)/company" app/api/company lib/validations.ts
git commit -m "feat: add company set-password flow for approved applications"
```

---

## Environment variables

Both are required before the feature works end to end. Set them locally in `.env` and in the Vercel project:

- `ADMIN_EMAILS` — comma-separated allow-list of admin email addresses. The first entry also receives new-application notifications. **Unset means nobody can reach `/admin/companies`** (fails closed).
- `PHONE_OTP_PROVIDER` — optional; defaults to `mock`. Any other value throws until a real provider is implemented.

## Manual verification after Task 6

1. `/sign-up` shows both cards; each links to the right form.
2. Individual signup with a phone number lands on `/verify-phone`, which shows the amber DEV MOCK box with a 6-digit code.
3. A wrong code shows the error; the correct code advances to `/verify-email`.
4. Signing in before phone confirmation fails; after both confirmations it succeeds.
5. `/onboarding/occupation` offers only Student and Other.
6. Company application submits and shows the confirmation page; a second submission with the same email is rejected.
7. `/admin/companies` 404s for a non-admin session and lists the pending application for an admin.
8. Approving sends the set-password email, creates the account, and the link sets a password and signs in successfully.
9. Rejecting moves the application to the Rejected tab and creates no account.
