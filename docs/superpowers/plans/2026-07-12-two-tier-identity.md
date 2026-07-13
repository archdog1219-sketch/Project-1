# Two-Tier Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LinkedIn-style two-tier identity: low-friction signup (real first+last name, enforced email confirmation, `.edu` capture) plus opt-in ID verification (mock provider behind a Stripe-Identity-shaped seam, real name-match enforcement) that buys a Verified badge and documented ranking boosts.

**Architecture:** Tier 1 reworks the existing credentials + OAuth signup paths (no new systems). Tier 2 adds one table (`IdentityVerification`) + `User.idVerified`/`User.hasEduEmail` denormalized flags, a provider seam in `lib/identity.ts` whose only v1 implementation is a clearly-labeled dev mock, a `/verify` flow, and badge/boost surfacing through the existing view types (`OpportunityView`, `FeedItem`, `Suggestion`). Ranking math changes are pure and unit-tested (`VERIFIED_OWNER_BONUS` in the matching scorer; verified-first tiebreak in suggestion ranking).

**Tech Stack:** Next.js 16 (App Router), Prisma 7 (+ Neon adapter, `db push`), NextAuth v5, Zod 4, Vitest, Resend (already wired), early-2000s inline theme (#3b5998).

---

## File Structure

- `prisma/schema.prisma` — MODIFY: `User.hasEduEmail`, `User.idVerified`, `IdentityVerification` model + `IdvStatus` enum.
- `lib/validations.ts` — MODIFY: `signUpSchema` gains firstName/lastName; new `identityMockSchema`.
- `app/(auth)/sign-up/page.tsx` — MODIFY: name fields + ToS small print; submit body.
- `app/api/auth/register/route.ts` — MODIFY: store `name`, set `hasEduEmail`.
- `lib/auth.ts` — MODIFY: `events.createUser` sets `hasEduEmail` for OAuth signups.
- `app/onboarding/basic-info/page.tsx` + `app/api/user/onboarding/basic-info/route.ts` + `basicInfoSchema` — MODIFY: stop collecting name.
- `lib/identity.ts` — NEW: name-match helper (pure), provider seam, mock provider, DB accessors.
- `lib/identity.test.ts` — NEW: name-match tests.
- `app/api/identity/start/route.ts`, `app/api/identity/complete/route.ts` — NEW.
- `app/(main)/verify/page.tsx` — NEW: status + payoff page. `app/(main)/verify/mock/page.tsx` + `mock-form.tsx` — NEW: labeled dev-mock flow.
- `components/verified-badge.tsx` — NEW: shared ✓ chip.
- Badge/boost surfacing — MODIFY: `lib/opportunities.ts` (`ownerVerified`), `lib/social.ts` (`actorVerified`, `Suggestion.verified`), `lib/matching.ts` (+bonus), `lib/feed-logic.ts` (tiebreak), `app/profile/[id]/page.tsx`, `app/(main)/feed/page.tsx`, `app/(main)/feed/feed-client.tsx`, `app/(main)/home-client.tsx`, `app/(main)/browse/browse-client.tsx`, `app/(main)/opportunities/[id]/page.tsx`, `app/(main)/discover/swipe-deck.tsx`, + test fixtures.

---

## Task 1: Schema

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Add flags + model**

In `model User`, after `onboardingComplete`:
```prisma
  hasEduEmail        Boolean   @default(false)
  idVerified         Boolean   @default(false)
```
In `model User` relations list add:
```prisma
  identityVerification IdentityVerification?
```
Append at end of file:
```prisma
enum IdvStatus {
  PENDING
  VERIFIED
  FAILED
}

model IdentityVerification {
  id             String    @id @default(cuid())
  userId         String    @unique
  status         IdvStatus @default(PENDING)
  provider       String    // "mock" now; "stripe_identity" / "persona" later
  providerRef    String?
  nameMatched    Boolean   @default(false)
  issuingCountry String?
  failureReason  String?
  createdAt      DateTime  @default(now())
  verifiedAt     DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2:** `npx prisma db push` → "in sync" (additive). If it doesn't regenerate, run `npx prisma generate`.
- [ ] **Step 3:** `npx tsc --noEmit` → PASS.
- [ ] **Step 4:**
```bash
git add prisma/schema.prisma && git commit -m "feat: add identity-verification model and user trust flags"
```

---

## Task 2: Tier-1 signup rework

**Files:** Modify `lib/validations.ts`, `app/(auth)/sign-up/page.tsx`, `app/api/auth/register/route.ts`, `lib/auth.ts`, `app/onboarding/basic-info/page.tsx`, `app/api/user/onboarding/basic-info/route.ts`

- [ ] **Step 1: Schema changes in `lib/validations.ts`**

In `signUpSchema`'s object (before `email`), add:
```typescript
    firstName: z.string().trim().min(1, "First name is required").max(50),
    lastName: z.string().trim().min(1, "Last name is required").max(50),
```
Change `basicInfoSchema` to drop the name field:
```typescript
export const basicInfoSchema = z.object({
  dateOfBirth: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), "Please enter a valid date"),
  city: z.string().min(2, "City must be at least 2 characters").max(100),
});
```

- [ ] **Step 2: Sign-up form** (`app/(auth)/sign-up/page.tsx`)

Read the file. In the local `form` state add `firstName: ""`, `lastName: ""`. Above the Email field add a two-column row using the existing style objects:
```tsx
<div style={{ display: "flex", gap: "8px" }}>
  <div style={{ ...s.field, flex: 1 }}>
    <label htmlFor="firstName" style={s.label}>First name</label>
    <input id="firstName" type="text" value={form.firstName}
      onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
      style={errors.firstName ? s.inputError : s.input} />
    {errors.firstName?.[0] && <p style={s.fieldError}>{errors.firstName[0]}</p>}
  </div>
  <div style={{ ...s.field, flex: 1 }}>
    <label htmlFor="lastName" style={s.label}>Last name</label>
    <input id="lastName" type="text" value={form.lastName}
      onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
      style={errors.lastName ? s.inputError : s.input} />
    {errors.lastName?.[0] && <p style={s.fieldError}>{errors.lastName[0]}</p>}
  </div>
</div>
```
(Adapt state/error accessors to the file's actual patterns after reading it.) Under the submit button add:
```tsx
<p style={{ fontSize: "10px", color: "#999", marginTop: "6px", textAlign: "center" }}>
  Our Terms require your real name. It isn&apos;t verified at signup — you can verify it later for a badge and boosts.
</p>
```
The fetch to `/api/auth/register` must include `firstName` and `lastName` in the JSON body.

- [ ] **Step 3: Register route** (`app/api/auth/register/route.ts`)

After parsing, destructure `const { email, password, firstName, lastName } = parsed.data;` and change the create to:
```typescript
  await db.user.create({
    data: {
      email,
      passwordHash,
      name: `${firstName.trim()} ${lastName.trim()}`,
      hasEduEmail: email.toLowerCase().endsWith(".edu"),
    },
  });
```

- [ ] **Step 4: OAuth `.edu` capture** (`lib/auth.ts`)

Add to the NextAuth config object (sibling of `callbacks`):
```typescript
  events: {
    async createUser({ user }) {
      if (user.id && user.email?.toLowerCase().endsWith(".edu")) {
        await db.user.update({ where: { id: user.id }, data: { hasEduEmail: true } });
      }
    },
  },
```

- [ ] **Step 5: Basic-info stops asking for name**

`app/onboarding/basic-info/page.tsx`: read it; remove the name input block and `name` from its form state/validation payload. Fetch the existing name for display: on mount `fetch("/api/user/me")` and render, above the DOB field:
```tsx
{displayName && (
  <p style={{ fontSize: "12px", color: "#666", margin: "0 0 10px" }}>
    Signing up as <b style={{ color: "#333" }}>{displayName}</b>
  </p>
)}
```
(`/api/user/me` already exists and returns the user; read it to confirm the field name.) `app/api/user/onboarding/basic-info/route.ts`: remove `name` from the parsed data and the `db.user.update` payload (schema change from Step 1 enforces it).

- [ ] **Step 6:** `npx tsc --noEmit` + `npm run build` → PASS. `npm test` → 50 pass.
- [ ] **Step 7:**
```bash
git add lib/validations.ts "app/(auth)/sign-up/page.tsx" app/api/auth/register/route.ts lib/auth.ts app/onboarding/basic-info/page.tsx app/api/user/onboarding/basic-info/route.ts
git commit -m "feat: require real name at signup and capture .edu school signal"
```

---

## Task 3: Identity seam + verify flow (TDD for name-match)

**Files:** Create `lib/identity.ts`, `lib/identity.test.ts`, `app/api/identity/start/route.ts`, `app/api/identity/complete/route.ts`, `app/(main)/verify/page.tsx`, `app/(main)/verify/mock/page.tsx`, `app/(main)/verify/mock/mock-form.tsx`; modify `lib/validations.ts`.

- [ ] **Step 1: Failing tests** — create `lib/identity.test.ts`:
```typescript
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
```

- [ ] **Step 2:** `npm test` → FAIL (module missing).

- [ ] **Step 3: Implement `lib/identity.ts`:**
```typescript
import { db } from "@/lib/db";
import { IdvStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Identity-verification provider seam.
// Shaped like Stripe Identity's session flow (create session → user completes
// → result recorded) so a real vendor can replace the mock by implementing
// IdentityProvider and switching IDV_PROVIDER — nothing else changes.
// Only a verification RECORD is ever stored: no ID images, no document numbers.
// ---------------------------------------------------------------------------

export interface IdentityProvider {
  name: string;
  /** Begin (or restart) verification; returns the URL the user should visit. */
  createSession(userId: string): Promise<{ url: string }>;
}

/** Case/whitespace-insensitive full-name comparison — the check that makes
 * "real name" real. Enforced identically by the mock and future vendors. */
export function namesMatch(profileName: string | null, legalName: string): boolean {
  if (!profileName || !legalName) return false;
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const a = norm(profileName);
  const b = norm(legalName);
  return a.length > 0 && a === b;
}

const mockProvider: IdentityProvider = {
  name: "mock",
  async createSession(userId: string) {
    await db.identityVerification.upsert({
      where: { userId },
      create: { userId, provider: "mock", status: IdvStatus.PENDING },
      update: { provider: "mock", status: IdvStatus.PENDING, failureReason: null },
    });
    return { url: "/verify/mock" };
  },
};

export function getIdentityProvider(): IdentityProvider {
  // IDV_PROVIDER=stripe_identity will select the real vendor once implemented.
  return mockProvider;
}

export async function getVerification(userId: string) {
  return db.identityVerification.findUnique({ where: { userId } });
}

/** Records a completed check. Sets the denormalized User.idVerified flag. */
export async function recordVerificationResult(
  userId: string,
  result: { passed: boolean; nameMatched: boolean; issuingCountry?: string; failureReason?: string }
) {
  const verified = result.passed && result.nameMatched;
  await db.identityVerification.update({
    where: { userId },
    data: {
      status: verified ? IdvStatus.VERIFIED : IdvStatus.FAILED,
      nameMatched: result.nameMatched,
      issuingCountry: result.issuingCountry ?? null,
      failureReason: verified ? null : result.failureReason ?? "Verification failed",
      verifiedAt: verified ? new Date() : null,
    },
  });
  await db.user.update({ where: { id: userId }, data: { idVerified: verified } });
  return verified;
}
```

- [ ] **Step 4:** `npm test` → PASS (55 total).

- [ ] **Step 5: Validation schema** — append to `lib/validations.ts`:
```typescript
export const identityMockSchema = z.object({
  legalFirstName: z.string().trim().min(1, "Required").max(50),
  legalLastName: z.string().trim().min(1, "Required").max(50),
  issuingCountry: z.string().trim().min(2).max(56),
  outcome: z.enum(["pass", "fail"]),
});
```

- [ ] **Step 6: API routes.**

`app/api/identity/start/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getIdentityProvider, getVerification } from "@/lib/identity";
import { getWriteRateLimit } from "@/lib/rate-limit";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { success } = await getWriteRateLimit().limit(session.user.id);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }
  const existing = await getVerification(session.user.id);
  if (existing?.status === "VERIFIED") {
    return NextResponse.json({ error: "You're already verified." }, { status: 400 });
  }
  const { url } = await getIdentityProvider().createSession(session.user.id);
  return NextResponse.json({ url });
}
```

`app/api/identity/complete/route.ts` (mock-only endpoint — a real vendor reports via webhook instead):
```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { identityMockSchema } from "@/lib/validations";
import { namesMatch, getVerification, recordVerificationResult, getIdentityProvider } from "@/lib/identity";
import { getWriteRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  if (getIdentityProvider().name !== "mock") {
    return NextResponse.json({ error: "Mock completion is disabled." }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { success } = await getWriteRateLimit().limit(session.user.id);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }
  const pending = await getVerification(session.user.id);
  if (!pending || pending.status === "VERIFIED") {
    return NextResponse.json({ error: "No verification in progress." }, { status: 400 });
  }
  const body = await request.json();
  const parsed = identityMockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const me = await db.user.findUnique({ where: { id: session.user.id }, select: { name: true } });
  const legalName = `${parsed.data.legalFirstName} ${parsed.data.legalLastName}`;
  const nameMatched = namesMatch(me?.name ?? null, legalName);
  const passed = parsed.data.outcome === "pass";
  const verified = await recordVerificationResult(session.user.id, {
    passed,
    nameMatched,
    issuingCountry: parsed.data.issuingCountry,
    failureReason: !passed
      ? "Simulated document/liveness failure"
      : !nameMatched
        ? "The name on your ID doesn't match your profile name."
        : undefined,
  });
  return NextResponse.json({ verified });
}
```

- [ ] **Step 7: Pages.**

`app/(main)/verify/page.tsx` (server):
```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getVerification } from "@/lib/identity";
import StartButton from "./start-button";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/verify");
  const v = await getVerification(session.user.id);

  const box = { border: "1px solid #c8d0e0", borderRadius: "3px", background: "#fff", padding: "14px 16px", marginBottom: "10px" };

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif", maxWidth: "560px", margin: "0 auto", padding: "16px" }}>
      <div style={{ fontSize: "16px", fontWeight: "bold", color: "#3b5998", marginBottom: "10px" }}>Verify your identity</div>

      {v?.status === "VERIFIED" ? (
        <div style={{ ...box, borderColor: "#2e7d32", background: "#f4fbf4" }}>
          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#2e7d32" }}>✓ You&apos;re verified</div>
          <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>
            Your profile shows the Verified badge{v.issuingCountry ? ` (ID issued in ${v.issuingCountry})` : ""}, and you rank higher in discovery.
          </div>
        </div>
      ) : (
        <>
          {v?.status === "FAILED" && (
            <div style={{ ...box, borderColor: "#e0b4b4", background: "#fff7f7" }}>
              <div style={{ fontSize: "12px", color: "#c00" }}>Last attempt failed: {v.failureReason}</div>
            </div>
          )}
          <div style={box}>
            <div style={{ fontSize: "12px", fontWeight: "bold", color: "#333", marginBottom: "6px" }}>What verification gets you</div>
            <ul style={{ fontSize: "12px", color: "#555", margin: 0, paddingLeft: "18px", lineHeight: 1.7 }}>
              <li>A <b>✓ Verified</b> badge on your profile, posts, and activity</li>
              <li>Higher ranking in &ldquo;students with similar interests&rdquo;</li>
              <li>If you post opportunities: a verified-poster mark and a match boost</li>
            </ul>
          </div>
          <div style={box}>
            <div style={{ fontSize: "12px", fontWeight: "bold", color: "#333", marginBottom: "6px" }}>How it works</div>
            <div style={{ fontSize: "12px", color: "#555", lineHeight: 1.7 }}>
              You&apos;ll confirm a government ID and a quick selfie. The name on your ID must match your profile name
              (<b>that&apos;s the point</b> — it makes your real name real). We store only a verification record — never your ID image or number.
            </div>
            <div style={{ fontSize: "11px", color: "#999", marginTop: "6px" }}>ID checks are for adults (18+). Verification is optional — unverified accounts keep full access.</div>
          </div>
          <StartButton />
        </>
      )}
      <div style={{ fontSize: "11px", marginTop: "10px" }}>
        <Link href={`/profile/${session.user.id}`} style={{ color: "#3b5998" }}>← Back to your profile</Link>
      </div>
    </div>
  );
}
```
Create `app/(main)/verify/start-button.tsx` (client): a `#3b5998` button "Start verification →" that POSTs `/api/identity/start`, then `router.push(data.url)`; shows returned `error` inline; `busy` disable.

`app/(main)/verify/mock/page.tsx` (server): auth-gated wrapper titled **"Identity check — DEV MOCK"** with an amber notice box: *"This simulates the Persona / Stripe Identity flow. No real vendor is configured (IDV_PROVIDER=mock)."* Renders `<MockForm />`.
`app/(main)/verify/mock/mock-form.tsx` (client): inputs Legal first name / Legal last name (labeled "as it appears on your ID"), a country `<select>` (a short list incl. United States, Canada, United Kingdom, India, Brazil, Germany, Japan, Australia, Other), and two buttons: green **"Simulate: document + selfie pass"** (`outcome:"pass"`) and gray **"Simulate: check fails"** (`outcome:"fail"`). POST `/api/identity/complete`; on response `router.push("/verify")`; error text inline. Early-2000s styles matching the matching-onboarding page.

- [ ] **Step 8:** `npx tsc --noEmit`, `npm run build` (routes `/verify`, `/verify/mock`, `/api/identity/*` present), `npm test` (55).
- [ ] **Step 9:**
```bash
git add lib/identity.ts lib/identity.test.ts lib/validations.ts app/api/identity "app/(main)/verify"
git commit -m "feat: add opt-in ID verification flow with mock provider and name-match"
```

---

## Task 4: Badge + school-signal surfacing

**Files:** Create `components/verified-badge.tsx`; modify `lib/opportunities.ts`, `lib/social.ts`, `app/profile/[id]/page.tsx`, `app/(main)/feed/page.tsx`, `app/(main)/feed/feed-client.tsx`, `app/(main)/home-client.tsx`, `app/(main)/browse/browse-client.tsx`, `app/(main)/opportunities/[id]/page.tsx`, `app/(main)/discover/swipe-deck.tsx`, and test fixtures (`lib/matching.test.ts`, `lib/discover-logic.test.ts`, `lib/feed-logic.test.ts` — add the new fields with `false` so they compile; behavior tests come in Task 5).

- [ ] **Step 1: Shared chip** — `components/verified-badge.tsx`:
```tsx
export default function VerifiedBadge({ size = 10 }: { size?: number }) {
  return (
    <span
      title="Identity verified"
      style={{ background: "#e8f0fe", color: "#1a56b0", border: "1px solid #b7cdf1", borderRadius: "2px", padding: "0 5px", fontSize: `${size}px`, fontWeight: "bold", whiteSpace: "nowrap" }}
    >
      ✓ Verified
    </span>
  );
}
```

- [ ] **Step 2: Data plumbing.**
- `lib/opportunities.ts`: add `ownerVerified: boolean` to `OpportunityView`. In both `getAllOpportunities` and `getOpportunityById` and `getOwnedOpportunities`, change the queries to `db.opportunity.findMany({ ..., include: { owner: { select: { idVerified: true } } } })` (same for `findUnique`) and change `toView` to accept the row with optional owner and map `ownerVerified: o.owner?.idVerified ?? false`. Type the parameter as `Prisma.OpportunityGetPayload<{ include: { owner: { select: { idVerified: true } } } }>`.
- `lib/social.ts`: `FeedItem` gains `actorVerified: boolean` (select `idVerified` in the actor include; map it). `Suggestion` gains `verified: boolean`; `getFollowSuggestions` selects `idVerified: true` on candidates and passes `verified: c.idVerified` through `rankSuggestions` (Task 5 updates the pure fn's type — in THIS task just add `idVerified` to the select and map `verified: false` placeholder if needed to keep compile green, or do Tasks 4+5 in one commit if simpler; the implementer may merge them, keeping tests green at each commit).
- `app/profile/[id]/page.tsx`: add `idVerified: true, hasEduEmail: true` to the user select. In the follow-block card render, above the counts: `{user.idVerified && <div style={{ textAlign: "center", marginBottom: "6px" }}><VerifiedBadge size={11} /></div>}` and `{user.hasEduEmail && <p style={{ fontSize: "10px", color: "#666", textAlign: "center", margin: "4px 0 0" }}>🎓 School email on file</p>}`. For the OWN profile when not verified, add a small CTA link in that card: `<Link href="/verify" ...>Get verified →</Link>`.
- `app/(main)/feed/page.tsx`: render `{e.actorVerified && <VerifiedBadge size={9} />}` right after the actor-name link.
- `app/(main)/feed/feed-client.tsx`: `SuggestionView` gains `verified: boolean`; render the badge after the name link.
- `app/(main)/home-client.tsx` + `browse-client.tsx`: in the card tag row, `{listing.ownerVerified && <VerifiedBadge size={9} />}`.
- `app/(main)/opportunities/[id]/page.tsx`: in the tags row after `TYPE_LABELS`, `{listing.ownerVerified && <VerifiedBadge size={10} />}`.
- `app/(main)/discover/swipe-deck.tsx`: in the chips row, `{o.ownerVerified && <VerifiedBadge size={9} />}`.
- Test fixtures: every `OpportunityView` factory (`opp()` in `lib/matching.test.ts` and `lib/discover-logic.test.ts`) gains `ownerVerified: false`.

- [ ] **Step 3:** `npx tsc --noEmit`, `npm run build`, `npm test` all green.
- [ ] **Step 4:**
```bash
git add components/verified-badge.tsx lib/opportunities.ts lib/social.ts "app/profile/[id]/page.tsx" "app/(main)" lib/matching.test.ts lib/discover-logic.test.ts
git commit -m "feat: surface verified badge and school signal across the app"
```

---

## Task 5: Ranking boosts (TDD)

**Files:** Modify `lib/matching.ts` + `lib/matching.test.ts`, `lib/feed-logic.ts` + `lib/feed-logic.test.ts`, `lib/social.ts` (final wiring).

- [ ] **Step 1: Failing tests.** In `lib/matching.test.ts` add:
```typescript
  it("gives verified-owner listings a bonus smaller than one interest match", () => {
    const base = scoreOpportunity(profile, opp({ targetInterests: [], targetGrades: [], location: "X" }));
    const boosted = scoreOpportunity(profile, opp({ targetInterests: [], targetGrades: [], location: "X", ownerVerified: true }));
    expect(boosted.score - base.score).toBe(1);
    const oneInterest = scoreOpportunity(profile, opp({ targetInterests: ["Technology"], targetGrades: [], location: "X" }));
    expect(boosted.score).toBeLessThan(oneInterest.score + base.score + 1);
  });
```
In `lib/feed-logic.test.ts` (`rankSuggestions` block; candidates gain `verified`):
```typescript
  it("ranks verified users first at equal shared-interest counts, but never above more-relevant unverified users", () => {
    const ranked = rankSuggestions(me, [
      { id: "unv2", name: "U2", interests: ["Technology", "Science"], verified: false },
      { id: "unv1", name: "U1", interests: ["Technology"], verified: false },
      { id: "ver1", name: "V1", interests: ["Technology"], verified: true },
    ], new Set());
    expect(ranked.map((u) => u.id)).toEqual(["unv2", "ver1", "unv1"]);
  });
```
Also update this file's existing candidate literals to include `verified: false`.

- [ ] **Step 2:** `npm test` → new tests FAIL.

- [ ] **Step 3: Implement.**
- `lib/matching.ts`: add `const VERIFIED_OWNER_BONUS = 1;` beside the other weights with a comment ("equal to the location weight, below one interest match — relevance still dominates"), and in `scoreOpportunity` after the location block: `if (o.ownerVerified) score += VERIFIED_OWNER_BONUS;` (no reason-string change).
- `lib/feed-logic.ts`: `SuggestionCandidate` gains `verified: boolean`; sort becomes `.sort((a, b) => b.shared - a.shared || Number(b.verified) - Number(a.verified));`.
- `lib/social.ts`: `getFollowSuggestions` passes `verified: c.idVerified` into candidates and maps it out to `Suggestion.verified` (removing any Task-4 placeholder).

- [ ] **Step 4:** `npm test` → all green (57+). `npx tsc --noEmit`, `npm run build`.
- [ ] **Step 5:**
```bash
git add lib/matching.ts lib/matching.test.ts lib/feed-logic.ts lib/feed-logic.test.ts lib/social.ts
git commit -m "feat: verified ranking boosts (matching bonus + suggestions tiebreak)"
```

---

## Self-Review Notes

- **Spec coverage:** Tier-1 (name at signup + ToS print, enforced email link kept, SSO untouched, `.edu` capture both paths, no phone) → Tasks 1–2. Tier-2 (seam, mock provider, name-match enforcement, record-only storage, issuing country, 18+ note, /verify flow, rate limits) → Tasks 1, 3. Privileges v1 (badge on profile/feed/rail/listings + boosts + zero negative pressure) → Tasks 4–5. Parked items are documentation-only.
- **Type consistency:** `OpportunityView.ownerVerified` flows scorer→deck→cards; `Suggestion.verified` flows social→rail; `FeedItem.actorVerified` feed-only. `namesMatch(profileName, legalName)` used only by the complete route. `IdvStatus` enum shared via Prisma client.
- **Sequencing note:** Task 4 Step 2 may leave `Suggestion.verified` as a placeholder until Task 5 wires the pure function — implementer may combine Tasks 4+5 into consecutive commits in one dispatch if that keeps every commit green.
- **No placeholders** beyond the explicitly-noted compile-bridge above; all code steps complete.
