# Swipe Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/discover` page that deals profile-ranked opportunity cards one at a time; swipe **left to save**, **right to skip** (user's explicit spec), with skips persisted so cards never re-appear.

**Architecture:** Reuse the Phase-1 scorer (`rankForUser`) as the ranking core. New pieces: an `OpportunitySkip` table (exclusion memory), a pure `buildDeck()` (filter acted-on → rank → cap 20), a `getSwipeDeck`/`recordSkip` accessor pair, a `POST /api/opportunities/[id]/swipe` route (dedicated 120/min rate limit), and a pointer-event card-deck client. Saves go through the existing `setSaveStatus(..., "SAVED")` — private (no feed event) and auto-appearing in the Tracker. `gradeLabelFor` (currently duplicated in the home page and the AI-draft route) gets extracted to `lib/matching.ts` since Discover is a third caller.

**Tech Stack:** Next.js 16 (App Router), Prisma 7 (+ Neon adapter), NextAuth v5 (`auth()`), Zod 4, Vitest, `@upstash/ratelimit`, current early-2000s inline theme (#3b5998, Arial — the Ivory & Brass redesign is paused and will restyle this page later).

---

## File Structure

- `prisma/schema.prisma` — MODIFY: add `OpportunitySkip` + relations on `User`/`Opportunity`.
- `lib/matching.ts` — MODIFY: add shared `gradeLabelFor(u, currentYear?)`.
- `lib/matching.test.ts` — MODIFY: add `gradeLabelFor` tests.
- `app/(main)/page.tsx`, `app/api/opportunities/[id]/draft/route.ts` — MODIFY: use the shared `gradeLabelFor`, delete local copies.
- `lib/discover-logic.ts` — NEW: pure `buildDeck()`.
- `lib/discover-logic.test.ts` — NEW: tests.
- `lib/discover.ts` — NEW: `getSwipeDeck`, `recordSkip`.
- `lib/validations.ts` — MODIFY: `swipeSchema`.
- `lib/rate-limit.ts` — MODIFY: `getSwipeRateLimit()` (120/min).
- `app/api/opportunities/[id]/swipe/route.ts` — NEW: swipe endpoint.
- `app/(main)/discover/page.tsx` — NEW: server page.
- `app/(main)/discover/swipe-deck.tsx` — NEW: client deck.
- `app/(main)/layout.tsx` — MODIFY: "Discover" nav link.

---

## Task 1: Schema — `OpportunitySkip`

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Add the model + relations**

Append at the end of `prisma/schema.prisma`:

```prisma
model OpportunitySkip {
  id            String   @id @default(cuid())
  userId        String
  opportunityId String
  createdAt     DateTime @default(now())

  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  opportunity Opportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)

  @@unique([userId, opportunityId])
  @@index([userId])
}
```

In `model User`, add to the relations list (next to `savedOpportunities`, `postedOpportunities`, etc.):
```prisma
  opportunitySkips OpportunitySkip[]
```
In `model Opportunity`, add to the relations block (next to `savedBy`, `feedEvents`, `aiDrafts`):
```prisma
  skips OpportunitySkip[]
```

- [ ] **Step 2: Apply to the database**

Run: `npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema." (Purely additive table — no data-loss prompt expected; if Prisma asks for `--accept-data-loss` on the new index, it's safe since the table is brand new.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — PASS; the generated client now has `db.opportunitySkip` with compound selector `userId_opportunityId`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add OpportunitySkip model for swipe discovery"
```

---

## Task 2: Shared `gradeLabelFor` (TDD)

**Files:**
- Modify: `lib/matching.ts`, `lib/matching.test.ts`
- Modify: `app/(main)/page.tsx`, `app/api/opportunities/[id]/draft/route.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/matching.test.ts` (it already imports from `./matching`; extend that import with `gradeLabelFor`):

```typescript
describe("gradeLabelFor", () => {
  it("returns College for college students (by occupationType or schoolLevel)", () => {
    expect(gradeLabelFor({ schoolLevel: null, graduationYear: null, occupationType: "STUDENT_COLLEGE" }, 2026)).toBe("College");
    expect(gradeLabelFor({ schoolLevel: "College", graduationYear: 2029, occupationType: null }, 2026)).toBe("College");
  });

  it("computes the grade from graduation year", () => {
    expect(gradeLabelFor({ schoolLevel: "High School", graduationYear: 2027, occupationType: "STUDENT_HS" }, 2026)).toBe("Grade 11");
    expect(gradeLabelFor({ schoolLevel: "High School", graduationYear: 2026, occupationType: null }, 2026)).toBe("Grade 12");
  });

  it("falls back to Grade 12 for high schoolers with out-of-range or missing grad years", () => {
    expect(gradeLabelFor({ schoolLevel: "High School", graduationYear: null, occupationType: null }, 2026)).toBe("Grade 12");
    expect(gradeLabelFor({ schoolLevel: null, graduationYear: 2040, occupationType: "STUDENT_HS" }, 2026)).toBe("Grade 12");
  });

  it("returns null when nothing indicates a grade", () => {
    expect(gradeLabelFor({ schoolLevel: null, graduationYear: null, occupationType: null }, 2026)).toBeNull();
    expect(gradeLabelFor({ schoolLevel: null, graduationYear: null, occupationType: "EMPLOYER" }, 2026)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npm test` — expected FAIL: `gradeLabelFor` is not exported.

- [ ] **Step 3: Implement in `lib/matching.ts`**

Append to `lib/matching.ts`:

```typescript
// Maps stored education info to the grade label the scorer expects
// ("College", "Grade 9".."Grade 12", or null). currentYear is injectable for tests.
export function gradeLabelFor(
  u: { schoolLevel: string | null; graduationYear: number | null; occupationType: string | null },
  currentYear: number = new Date().getFullYear()
): string | null {
  if (u.occupationType === "STUDENT_COLLEGE" || u.schoolLevel === "College") return "College";
  if (u.graduationYear != null) {
    const grade = 12 - (u.graduationYear - currentYear);
    if (grade >= 9 && grade <= 12) return `Grade ${grade}`;
  }
  if (u.schoolLevel === "High School" || u.occupationType === "STUDENT_HS") return "Grade 12";
  return null;
}
```

- [ ] **Step 4: Run to verify PASS**

Run: `npm test` — all tests green.

- [ ] **Step 5: Switch the two existing callers to the shared function**

1. `app/(main)/page.tsx`: add `gradeLabelFor` to the existing `@/lib/matching` import; delete the local `function gradeLabelFor(...)` at the bottom of the file; remove the now-unused `import { OccupationType } from "@prisma/client";` line. (The call site `gradeLabelFor(user)` stays as-is — the Prisma enum value is assignable to `string | null`.)
2. `app/api/opportunities/[id]/draft/route.ts`: import `gradeLabelFor` from `@/lib/matching`; delete the local copy; remove the now-unused `OccupationType` import if nothing else uses it.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` (PASS) and `npm run build` (PASS).

- [ ] **Step 7: Commit**

```bash
git add lib/matching.ts lib/matching.test.ts "app/(main)/page.tsx" "app/api/opportunities/[id]/draft/route.ts"
git commit -m "refactor: extract shared gradeLabelFor into lib/matching with tests"
```

---

## Task 3: Pure `buildDeck` (TDD)

**Files:**
- Create: `lib/discover-logic.ts`
- Test: `lib/discover-logic.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/discover-logic.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildDeck, DEFAULT_DECK_SIZE } from "./discover-logic";
import type { MatchProfile } from "./matching";
import type { OpportunityView } from "./opportunities";

const profile: MatchProfile = {
  gradeLabel: "Grade 11",
  location: "New York, NY",
  interests: ["Technology"],
};

function opp(id: string, over: Partial<OpportunityView> = {}): OpportunityView {
  return {
    id, title: "T", org: "O", type: "Internships", location: "Remote",
    description: "", tags: [], deadline: null, applyUrl: null,
    targetGrades: [], targetInterests: [], isPaid: false, ...over,
  };
}

describe("buildDeck", () => {
  it("excludes opportunities the user has already acted on", () => {
    const deck = buildDeck(profile, [opp("a"), opp("b"), opp("c")], new Set(["b"]));
    expect(deck.map((d) => d.opportunity.id).sort()).toEqual(["a", "c"]);
  });

  it("ranks the deck best-match-first", () => {
    const deck = buildDeck(profile, [
      opp("weak", { targetInterests: ["Law"], targetGrades: ["College"], location: "Boston, MA" }),
      opp("strong", { targetInterests: ["Technology"], targetGrades: ["Grade 11"], location: "New York, NY" }),
    ], new Set());
    expect(deck[0].opportunity.id).toBe("strong");
  });

  it("caps the deck at the limit", () => {
    const many = Array.from({ length: 30 }, (_, i) => opp(`o${i}`));
    expect(buildDeck(profile, many, new Set()).length).toBe(DEFAULT_DECK_SIZE);
    expect(buildDeck(profile, many, new Set(), 5).length).toBe(5);
  });

  it("returns an empty deck when everything is excluded", () => {
    const deck = buildDeck(profile, [opp("a")], new Set(["a"]));
    expect(deck).toEqual([]);
  });

  it("still deals cards for an empty profile (all score 0)", () => {
    const deck = buildDeck({ gradeLabel: null, location: null, interests: [] }, [opp("a", { targetGrades: ["Grade 11"] })], new Set());
    expect(deck.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

Run: `npm test` — expected FAIL: cannot find module `./discover-logic`.

- [ ] **Step 3: Implement**

Create `lib/discover-logic.ts`:

```typescript
import type { OpportunityView } from "./opportunities";
import { rankForUser, type MatchProfile, type ScoredOpportunity } from "./matching";

export const DEFAULT_DECK_SIZE = 20;

// Composes the Discover deck: drops opportunities the user has already acted on
// (saved at any status, or skipped), ranks the rest by profile match, caps the size.
export function buildDeck(
  profile: MatchProfile,
  opportunities: OpportunityView[],
  excludedIds: ReadonlySet<string>,
  limit: number = DEFAULT_DECK_SIZE
): ScoredOpportunity[] {
  const candidates = opportunities.filter((o) => !excludedIds.has(o.id));
  return rankForUser(profile, candidates).slice(0, limit);
}
```

- [ ] **Step 4: Run to verify PASS**

Run: `npm test` — all green.

- [ ] **Step 5: Commit**

```bash
git add lib/discover-logic.ts lib/discover-logic.test.ts
git commit -m "feat: add pure deck-composition logic for swipe discovery"
```

---

## Task 4: Accessors, schema, rate limit, swipe route

**Files:**
- Create: `lib/discover.ts`
- Modify: `lib/validations.ts`, `lib/rate-limit.ts`
- Create: `app/api/opportunities/[id]/swipe/route.ts`

- [ ] **Step 1: Zod schema**

Append to `lib/validations.ts` (reuse the existing `z` import):

```typescript
export const swipeSchema = z.object({
  direction: z.enum(["save", "skip"]),
});

export type SwipeInput = z.infer<typeof swipeSchema>;
```

- [ ] **Step 2: Rate limiter**

Append to `lib/rate-limit.ts` after `getPostRateLimit`:

```typescript
// Swiping is a legitimately high-frequency action — the shared 40/min write
// limiter would throttle a fast swiper mid-deck, so it gets its own budget.
export function getSwipeRateLimit() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(120, "1 m"),
    prefix: "ratelimit:swipe",
  });
}
```

- [ ] **Step 3: DB accessors**

Create `lib/discover.ts`:

```typescript
import { db } from "@/lib/db";
import { getAllOpportunities } from "@/lib/opportunities";
import { gradeLabelFor, type MatchProfile, type ScoredOpportunity } from "@/lib/matching";
import { buildDeck, DEFAULT_DECK_SIZE } from "@/lib/discover-logic";

export interface SwipeDeckResult {
  deck: ScoredOpportunity[];
  hasMatchingProfile: boolean;
}

export async function getSwipeDeck(userId: string, limit = DEFAULT_DECK_SIZE): Promise<SwipeDeckResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { schoolLevel: true, graduationYear: true, city: true, interests: true, occupationType: true },
  });
  if (!user) return { deck: [], hasMatchingProfile: false };

  const profile: MatchProfile = {
    gradeLabel: gradeLabelFor(user),
    location: user.city ?? null,
    interests: user.interests ?? [],
  };

  const [all, saved, skipped] = await Promise.all([
    getAllOpportunities(),
    db.savedOpportunity.findMany({ where: { userId }, select: { opportunityId: true } }),
    db.opportunitySkip.findMany({ where: { userId }, select: { opportunityId: true } }),
  ]);

  const excluded = new Set<string>([
    ...saved.map((s) => s.opportunityId),
    ...skipped.map((s) => s.opportunityId),
  ]);

  return {
    deck: buildDeck(profile, all, excluded, limit),
    hasMatchingProfile: profile.interests.length > 0,
  };
}

// Idempotent: re-skipping the same opportunity is a no-op.
export async function recordSkip(userId: string, opportunityId: string): Promise<void> {
  await db.opportunitySkip.upsert({
    where: { userId_opportunityId: { userId, opportunityId } },
    create: { userId, opportunityId },
    update: {},
  });
}
```

- [ ] **Step 4: The swipe route**

Create `app/api/opportunities/[id]/swipe/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { swipeSchema } from "@/lib/validations";
import { setSaveStatus } from "@/lib/social";
import { recordSkip } from "@/lib/discover";
import { getSwipeRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = await getSwipeRateLimit().limit(session.user.id);
  if (!success) {
    return NextResponse.json({ error: "Whoa — you're swiping fast. Give it a minute." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = swipeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { id } = await params;
  const opportunity = await db.opportunity.findUnique({ where: { id }, select: { id: true } });
  if (!opportunity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.direction === "save") {
    await setSaveStatus(session.user.id, id, "SAVED");
  } else {
    await recordSkip(session.user.id, id);
  }

  return NextResponse.json({ result: parsed.data.direction });
}
```

(`setSaveStatus` accepts the Prisma `SaveStatus`; the literal `"SAVED"` is assignable. A swipe-save is private — `SAVED` emits no feed event — and appears in the Tracker's Saved lane.)

- [ ] **Step 5: Verify**

1. `npx tsc --noEmit` — PASS.
2. `npm run build` — PASS; `/api/opportunities/[id]/swipe` in the route list.
3. Live check (DB reachable): create `_check.mjs`:
   ```javascript
   import "dotenv/config";
   import { getSwipeDeck } from "./lib/discover.ts";
   const r = await getSwipeDeck("nobody");
   console.log("deck:", r.deck.length, "profile:", r.hasMatchingProfile);
   process.exit(0);
   ```
   Run `npx tsx _check.mjs` — expect `deck: 0 profile: false` (unknown user), no error. DELETE `_check.mjs` afterward.

- [ ] **Step 6: Commit**

```bash
git add lib/discover.ts lib/validations.ts lib/rate-limit.ts "app/api/opportunities/[id]/swipe"
git commit -m "feat: add swipe deck accessor and swipe API route"
```

---

## Task 5: Discover page, swipe deck UI, nav link

**Files:**
- Create: `app/(main)/discover/swipe-deck.tsx`
- Create: `app/(main)/discover/page.tsx`
- Modify: `app/(main)/layout.tsx`

- [ ] **Step 1: The client deck**

Create `app/(main)/discover/swipe-deck.tsx`:

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TYPE_LABELS } from "@/lib/listings";
import type { ScoredOpportunity } from "@/lib/matching";

const THRESHOLD = 90; // px of drag before a release commits the swipe
const FLY_MS = 220;

export default function SwipeDeck({ initialDeck }: { initialDeck: ScoredOpportunity[] }) {
  const [deck, setDeck] = useState(initialDeck);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<"save" | "skip" | null>(null);
  const [error, setError] = useState("");
  const startX = useRef(0);

  const total = initialDeck.length;
  const current = deck[0];
  const next = deck[1];
  const position = total - deck.length + 1;

  function commit(direction: "save" | "skip") {
    if (!current || leaving) return;
    setError("");
    setLeaving(direction);
    const card = current;
    setTimeout(() => {
      setLeaving(null);
      setDx(0);
      setDeck((d) => d.slice(1));
      void (async () => {
        try {
          const res = await fetch(`/api/opportunities/${card.opportunity.id}/swipe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ direction }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setError(typeof data.error === "string" ? data.error : "That didn't save — the card is back on top.");
            setDeck((d) => [card, ...d]);
          }
        } catch {
          setError("That didn't save — the card is back on top.");
          setDeck((d) => [card, ...d]);
        }
      })();
    }, FLY_MS);
  }

  // Keyboard: ← save, → skip (matches the swipe directions).
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") commitRef.current("save");
      if (e.key === "ArrowRight") commitRef.current("skip");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (leaving) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    setDragging(true);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || leaving) return;
    setDx(e.clientX - startX.current);
  }
  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (dx <= -THRESHOLD) commit("save");
    else if (dx >= THRESHOLD) commit("skip");
    else setDx(0);
  }

  if (!current) {
    return (
      <div style={{ border: "1px solid #c8d0e0", borderRadius: "3px", background: "#fff", padding: "24px 16px", textAlign: "center" }}>
        <div style={{ fontSize: "22px", marginBottom: "6px" }}>🎉</div>
        <div style={{ fontSize: "13px", fontWeight: "bold", color: "#3b5998", marginBottom: "4px" }}>You&apos;re all caught up</div>
        <div style={{ fontSize: "11px", color: "#666", marginBottom: "10px" }}>You&apos;ve gone through every recommendation. Check back when new opportunities are posted.</div>
        <div style={{ fontSize: "11px" }}>
          <Link href="/tracker" style={{ color: "#3b5998" }}>See what you saved →</Link>
          {" · "}
          <Link href="/browse" style={{ color: "#3b5998" }}>Browse everything</Link>
        </div>
      </div>
    );
  }

  const leavingX = leaving === "save" ? -600 : leaving === "skip" ? 600 : 0;
  const x = leaving ? leavingX : dx;
  const rot = x * 0.06;
  const saveOpacity = Math.min(1, Math.max(0, (-x - 30) / (THRESHOLD - 30)));
  const skipOpacity = Math.min(1, Math.max(0, (x - 30) / (THRESHOLD - 30)));
  const o = current.opportunity;

  return (
    <div>
      <div style={{ fontSize: "10px", color: "#999", textAlign: "center", marginBottom: "6px" }}>
        {Math.min(position, total)} of {total}
      </div>

      <div style={{ position: "relative", height: "300px" }}>
        {next && (
          <div style={{ position: "absolute", inset: 0, border: "1px solid #c8d0e0", borderRadius: "4px", background: "#fff", transform: "scale(0.96) translateY(8px)", opacity: 0.6 }} />
        )}

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: "absolute", inset: 0,
            border: "1px solid #c8d0e0", borderRadius: "4px", background: "#fff",
            padding: "14px 16px", cursor: dragging ? "grabbing" : "grab",
            touchAction: "none", userSelect: "none",
            transform: `translateX(${x}px) rotate(${rot}deg)`,
            transition: dragging ? "none" : `transform ${FLY_MS}ms ease, opacity ${FLY_MS}ms ease`,
            opacity: leaving ? 0 : 1,
            display: "flex", flexDirection: "column",
          }}
        >
          {/* stamps */}
          <div style={{ position: "absolute", top: "12px", left: "12px", border: "2px solid #2e7d32", color: "#2e7d32", fontWeight: "bold", fontSize: "14px", padding: "2px 10px", borderRadius: "3px", transform: "rotate(-12deg)", opacity: saveOpacity }}>SAVE 💾</div>
          <div style={{ position: "absolute", top: "12px", right: "12px", border: "2px solid #999", color: "#999", fontWeight: "bold", fontSize: "14px", padding: "2px 10px", borderRadius: "3px", transform: "rotate(12deg)", opacity: skipOpacity }}>SKIP ✕</div>

          <div style={{ fontSize: "15px", fontWeight: "bold", color: "#3b5998", marginTop: "18px" }}>{o.title}</div>
          <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>{o.org} &nbsp;·&nbsp; {o.location}</div>

          <div style={{ display: "flex", gap: "4px", marginTop: "8px", flexWrap: "wrap" }}>
            <span style={{ background: "#d8dfea", color: "#3b5998", borderRadius: "2px", padding: "1px 6px", fontSize: "10px", fontWeight: "bold" }}>{TYPE_LABELS[o.type]}</span>
            {current.reason && (
              <span style={{ background: "#e8f5e9", color: "#2e7d32", borderRadius: "2px", padding: "1px 6px", fontSize: "10px" }}>✓ {current.reason}</span>
            )}
            {o.deadline && (
              <span style={{ background: "#fff3e0", color: "#b26a00", borderRadius: "2px", padding: "1px 6px", fontSize: "10px" }}>⏰ {o.deadline}</span>
            )}
          </div>

          <p style={{ fontSize: "12px", color: "#333", lineHeight: 1.5, marginTop: "10px", flex: 1, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical" }}>
            {o.description}
          </p>

          <div style={{ marginTop: "8px" }}>
            <Link
              href={`/opportunities/${o.id}`}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ fontSize: "11px", color: "#3b5998", textDecoration: "underline" }}
            >
              View full details →
            </Link>
          </div>
        </div>
      </div>

      {error && <div style={{ color: "#c00", fontSize: "11px", textAlign: "center", marginTop: "8px" }}>{error}</div>}

      <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "12px" }}>
        <button
          onClick={() => commit("save")}
          disabled={!!leaving}
          style={{ background: "#e8f5e9", color: "#2e7d32", border: "1px solid #2e7d32", padding: "7px 18px", fontSize: "12px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer" }}
        >
          💾 Save (←)
        </button>
        <button
          onClick={() => commit("skip")}
          disabled={!!leaving}
          style={{ background: "#f0f0f0", color: "#555", border: "1px solid #bbb", padding: "7px 18px", fontSize: "12px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer" }}
        >
          Skip ✕ (→)
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: The server page**

Create `app/(main)/discover/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getSwipeDeck } from "@/lib/discover";
import SwipeDeck from "./swipe-deck";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/discover");

  const { deck, hasMatchingProfile } = await getSwipeDeck(session.user.id);

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif", maxWidth: "480px", margin: "0 auto", padding: "16px" }}>
      <div style={{ textAlign: "center", fontSize: "15px", fontWeight: "bold", color: "#3b5998", marginBottom: "3px" }}>Discover</div>
      <div style={{ textAlign: "center", fontSize: "11px", color: "#666", marginBottom: "12px" }}>
        Swipe <b>left to save</b>, <b>right to skip</b> — or use the buttons below.
      </div>
      {!hasMatchingProfile && (
        <div style={{ fontSize: "11px", color: "#666", background: "#e8edf5", border: "1px solid #c8d0e0", borderRadius: "3px", padding: "7px 10px", marginBottom: "10px", textAlign: "center" }}>
          <Link href="/onboarding/matching" style={{ color: "#3b5998" }}>Add your interests</Link> to get better recommendations.
        </div>
      )}
      <SwipeDeck initialDeck={deck} />
    </div>
  );
}
```

- [ ] **Step 3: Nav link**

In `app/(main)/layout.tsx`, in the nav-links row (currently `Home / Feed / Tracker / Browse / About` + employer-conditional `Post / My Postings`), add after Home:
```tsx
<Link href="/discover" className="nav-link">Discover</Link>
```
Change nothing else.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` (PASS), `npm run build` (PASS; `/discover` dynamic `ƒ`), `npm test` (all green).

- [ ] **Step 5: Commit**

```bash
git add "app/(main)/discover" "app/(main)/layout.tsx"
git commit -m "feat: add Discover swipe page with card deck and nav link"
```

---

## Self-Review Notes

- **Spec coverage:** one-at-a-time recommendations → deck UI (Task 5); left=save / right=skip exactly as specified → `commit("save")` on `dx <= -THRESHOLD`, buttons/keyboard match; profile-based algorithm (grade/location/interests) → reuses `rankForUser` via `buildDeck` (Tasks 3–4) with `gradeLabelFor` (Task 2); exclusion memory → `OpportunitySkip` (Task 1) + saved-any-status filter (Task 4); saves are private + land in Tracker → `setSaveStatus(..., "SAVED")`; dedicated 120/min limiter; empty-profile hint; empty-deck state; nav link.
- **Type consistency:** `ScoredOpportunity`/`MatchProfile` come from `lib/matching.ts` and flow through `buildDeck` → `getSwipeDeck` → page → `SwipeDeck` props (fully serializable — `OpportunityView` is plain data). `TYPE_LABELS[o.type]` keys on the friendly label, which `OpportunityView.type` is. `userId_opportunityId` matches the `@@unique` in Task 1.
- **No placeholders:** every code step is complete.
