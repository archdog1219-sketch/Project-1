# Phase 3 (Deadline Tracker + AI Application Assist) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give students a personal deadline tracker (Saved → Applying → Applied lanes with deadline warnings) and an AI "generate a cover letter draft" feature on each opportunity, powered by Claude Haiku.

**Architecture:** The tracker reuses the existing `SavedOpportunity` model and the existing `POST /api/opportunities/[id]/save` route for status changes — it's a new read view (`/tracker`) over data the user already creates. The AI assist adds the official Anthropic SDK behind a server route that loads the student's profile + the opportunity, asks Claude Haiku for a tailored cover-letter draft, and persists it in the existing `AiDraft` table. Pure logic (deadline math, grouping, prompt assembly) is unit-tested with Vitest; the LLM call and pages are verified by build + manual.

**Tech Stack:** Next.js 16 (App Router), Prisma 7 (+ `@prisma/adapter-neon`), NextAuth v5 (`auth()`), Zod 4, Vitest, `@anthropic-ai/sdk` (NEW), `@upstash/ratelimit` (existing), TypeScript. AI model: `claude-haiku-4-5` (fast + cheap for short-form generation; Haiku does not support the `effort` param, so it is omitted). Early-2000s inline-style theme (`#3b5998`).

**External prerequisite:** The AI feature requires an `ANTHROPIC_API_KEY` env var (local `.env` + Vercel). The route degrades gracefully (503 + friendly message) when it is absent, so the rest of the app — including the tracker — builds and runs without it.

---

## File Structure

- `lib/tracker-logic.ts` — NEW. Pure: `daysUntil`, `deadlineInfo`, `STATUS_LANES`, `groupByStatus`.
- `lib/tracker-logic.test.ts` — NEW. Vitest unit tests.
- `lib/social.ts` — MODIFY. Add `getTrackedOpportunities(userId)`.
- `app/(main)/tracker/tracker-card.tsx` — NEW. Client status `<select>` per card (reuses the save route).
- `app/(main)/tracker/page.tsx` — NEW. Server, auth-gated; groups tracked items into lanes.
- `app/(main)/layout.tsx` — MODIFY. Add a "Tracker" nav link.
- `lib/rate-limit.ts` — MODIFY. Add `getAiDraftRateLimit()`.
- `lib/ai.ts` — NEW. `buildCoverLetterPrompt` (pure) + `generateCoverLetter` (Anthropic call, lazy client).
- `lib/ai.test.ts` — NEW. Vitest test for `buildCoverLetterPrompt`.
- `app/api/opportunities/[id]/draft/route.ts` — NEW. POST: auth + rate-limit + generate + persist `AiDraft`.
- `app/(main)/opportunities/[id]/ai-assist.tsx` — NEW. Client "Generate draft" UI (editable, Copy/Regenerate).
- `app/(main)/opportunities/[id]/page.tsx` — MODIFY. Load existing draft; render `<AiAssist>` for signed-in users.

---

## Task 1: Tracker pure helpers (TDD)

**Files:**
- Create: `lib/tracker-logic.ts`
- Test: `lib/tracker-logic.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/tracker-logic.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { daysUntil, deadlineInfo, groupByStatus, STATUS_LANES } from "./tracker-logic";

const NOW = new Date("2026-01-10T00:00:00Z");

describe("daysUntil", () => {
  it("returns null for null or unparseable deadlines", () => {
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil("whenever", NOW)).toBeNull();
  });
  it("computes whole days until a parseable date", () => {
    expect(daysUntil("January 15, 2026", NOW)).toBe(5);
  });
  it("returns a negative number for past deadlines", () => {
    expect(daysUntil("January 5, 2026", NOW)).toBe(-5);
  });
});

describe("deadlineInfo", () => {
  it("labels no deadline", () => {
    expect(deadlineInfo(null, NOW)).toEqual({ text: "No deadline", urgent: false });
  });
  it("flags deadlines within 7 days as urgent", () => {
    expect(deadlineInfo("January 15, 2026", NOW)).toEqual({ text: "Due in 5 days", urgent: true });
  });
  it("says 'Due today' at 0 days", () => {
    expect(deadlineInfo("January 10, 2026", NOW)).toEqual({ text: "Due today", urgent: true });
  });
  it("marks past deadlines as passed (not urgent)", () => {
    expect(deadlineInfo("January 5, 2026", NOW)).toEqual({ text: "Deadline passed", urgent: false });
  });
  it("shows the raw deadline for far-off dates", () => {
    expect(deadlineInfo("March 1, 2026", NOW)).toEqual({ text: "March 1, 2026", urgent: false });
  });
});

describe("groupByStatus", () => {
  it("groups items into the three lanes preserving input order", () => {
    const items = [
      { id: "1", status: "APPLIED" as const },
      { id: "2", status: "SAVED" as const },
      { id: "3", status: "SAVED" as const },
      { id: "4", status: "APPLYING" as const },
    ];
    const grouped = groupByStatus(items);
    expect(grouped.SAVED.map((i) => i.id)).toEqual(["2", "3"]);
    expect(grouped.APPLYING.map((i) => i.id)).toEqual(["4"]);
    expect(grouped.APPLIED.map((i) => i.id)).toEqual(["1"]);
  });
  it("exposes lane order Saved → Applying → Applied", () => {
    expect(STATUS_LANES).toEqual(["SAVED", "APPLYING", "APPLIED"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it FAILS**

Run: `npm test`
Expected: FAIL — cannot find module `./tracker-logic`.

- [ ] **Step 3: Implement**

Create `lib/tracker-logic.ts`:

```typescript
export type TrackerStatus = "SAVED" | "APPLYING" | "APPLIED";

export const STATUS_LANES: TrackerStatus[] = ["SAVED", "APPLYING", "APPLIED"];

export const LANE_LABELS: Record<TrackerStatus, string> = {
  SAVED: "📌 Saved",
  APPLYING: "✍️ Applying",
  APPLIED: "✅ Applied",
};

// Whole days from `now` until the deadline. null if absent/unparseable.
export function daysUntil(deadline: string | null, now: Date = new Date()): number | null {
  if (!deadline) return null;
  const ts = Date.parse(deadline);
  if (Number.isNaN(ts)) return null;
  const MS_PER_DAY = 86_400_000;
  return Math.round((ts - now.getTime()) / MS_PER_DAY);
}

export interface DeadlineInfo {
  text: string;
  urgent: boolean;
}

// A display label + urgency flag for a deadline string.
export function deadlineInfo(deadline: string | null, now: Date = new Date()): DeadlineInfo {
  const days = daysUntil(deadline, now);
  if (days === null) return { text: "No deadline", urgent: false };
  if (days < 0) return { text: "Deadline passed", urgent: false };
  if (days === 0) return { text: "Due today", urgent: true };
  if (days <= 7) return { text: `Due in ${days} day${days === 1 ? "" : "s"}`, urgent: true };
  return { text: deadline as string, urgent: false };
}

// Groups items (each carrying a `status`) into the three lanes, preserving input order.
export function groupByStatus<T extends { status: TrackerStatus }>(
  items: T[]
): Record<TrackerStatus, T[]> {
  const out: Record<TrackerStatus, T[]> = { SAVED: [], APPLYING: [], APPLIED: [] };
  for (const item of items) {
    out[item.status].push(item);
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it PASSES**

Run: `npm test`
Expected: PASS (existing tests + these).

- [ ] **Step 5: Commit**

```bash
git add lib/tracker-logic.ts lib/tracker-logic.test.ts
git commit -m "feat: add pure tracker helpers (deadline math, lane grouping) with tests"
```

---

## Task 2: Tracker DB accessor

**Files:**
- Modify: `lib/social.ts`

- [ ] **Step 1: Add the accessor**

Append to `lib/social.ts`:

```typescript
// --- Tracker ---

export interface TrackedItem {
  savedId: string;
  status: SaveStatus;
  opportunityId: string;
  title: string;
  org: string;
  deadline: string | null;
}

export async function getTrackedOpportunities(userId: string): Promise<TrackedItem[]> {
  const rows = await db.savedOpportunity.findMany({
    where: { userId },
    orderBy: { savedAt: "desc" },
    include: {
      opportunity: { select: { id: true, title: true, org: true, deadline: true } },
    },
  });
  return rows.map((r) => ({
    savedId: r.id,
    status: r.status,
    opportunityId: r.opportunity.id,
    title: r.opportunity.title,
    org: r.opportunity.org,
    deadline: r.opportunity.deadline,
  }));
}
```

(`SaveStatus` is already imported at the top of `lib/social.ts` from `@prisma/client`. The Prisma enum is `SAVED|APPLYING|APPLIED`, which matches `TrackerStatus` — they're structurally compatible.)

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/social.ts
git commit -m "feat: add getTrackedOpportunities accessor"
```

---

## Task 3: Tracker page + status control

**Files:**
- Create: `app/(main)/tracker/tracker-card.tsx`
- Create: `app/(main)/tracker/page.tsx`

- [ ] **Step 1: Create the client status control**

Create `app/(main)/tracker/tracker-card.tsx`:

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import type { TrackerStatus } from "@/lib/tracker-logic";

export default function TrackerCard({
  opportunityId,
  title,
  org,
  deadlineText,
  deadlineUrgent,
  initialStatus,
}: {
  opportunityId: string;
  title: string;
  org: string;
  deadlineText: string;
  deadlineUrgent: boolean;
  initialStatus: TrackerStatus;
}) {
  const [status, setStatus] = useState<TrackerStatus>(initialStatus);
  const [busy, setBusy] = useState(false);

  async function change(next: TrackerStatus) {
    const prev = status;
    setStatus(next); // optimistic
    setBusy(true);
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) setStatus(prev); // revert on failure
    } catch {
      setStatus(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ border: deadlineUrgent ? "1px solid #f5b800" : "1px solid #c8d0e0", background: deadlineUrgent ? "#fffdf5" : "#fff", borderRadius: "3px", padding: "7px 9px", marginBottom: "5px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
        <div style={{ minWidth: 0 }}>
          <Link href={`/opportunities/${opportunityId}`} style={{ color: "#3b5998", fontWeight: "bold", fontSize: "12px", textDecoration: "none" }}>{title}</Link>
          <div style={{ fontSize: "10px", color: deadlineUrgent ? "#c00" : "#666", fontWeight: deadlineUrgent ? "bold" : "normal" }}>
            {org} · {deadlineUrgent ? "⏰ " : ""}{deadlineText}
          </div>
        </div>
        <select
          value={status}
          disabled={busy}
          onChange={(e) => change(e.target.value as TrackerStatus)}
          style={{ border: "1px solid #bdc7d8", fontSize: "10px", padding: "2px", borderRadius: "2px" }}
        >
          <option value="SAVED">Saved</option>
          <option value="APPLYING">Applying</option>
          <option value="APPLIED">Applied</option>
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the tracker page**

Create `app/(main)/tracker/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTrackedOpportunities } from "@/lib/social";
import { groupByStatus, deadlineInfo, STATUS_LANES, LANE_LABELS } from "@/lib/tracker-logic";
import TrackerCard from "./tracker-card";

export const dynamic = "force-dynamic";

export default async function TrackerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/tracker");

  const items = await getTrackedOpportunities(session.user.id);
  const grouped = groupByStatus(items);

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif", maxWidth: "720px", margin: "0 auto", padding: "12px 16px" }}>
      <div style={{ fontSize: "13px", fontWeight: "bold", color: "#3b5998", marginBottom: "10px" }}>My Tracker</div>

      {items.length === 0 ? (
        <div style={{ fontSize: "12px", color: "#666", border: "1px solid #c8d0e0", borderRadius: "3px", background: "#fff", padding: "16px" }}>
          You haven&apos;t saved anything yet. Browse opportunities and hit <b>Save</b> or <b>Mark as applied</b> to track them here.
        </div>
      ) : (
        STATUS_LANES.map((lane) => (
          <div key={lane} style={{ marginBottom: "14px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "5px" }}>
              {LANE_LABELS[lane]} ({grouped[lane].length})
            </div>
            {grouped[lane].length === 0 ? (
              <div style={{ fontSize: "11px", color: "#999", paddingBottom: "4px" }}>Nothing here yet.</div>
            ) : (
              grouped[lane].map((item) => {
                const info = deadlineInfo(item.deadline);
                return (
                  <TrackerCard
                    key={item.savedId}
                    opportunityId={item.opportunityId}
                    title={item.title}
                    org={item.org}
                    deadlineText={info.text}
                    deadlineUrgent={info.urgent}
                    initialStatus={item.status}
                  />
                );
              })
            )}
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: PASS; `/tracker` appears as dynamic `ƒ`.

- [ ] **Step 4: Commit**

```bash
git add "app/(main)/tracker"
git commit -m "feat: add deadline tracker page with status lanes"
```

---

## Task 4: Tracker nav link

**Files:**
- Modify: `app/(main)/layout.tsx`

- [ ] **Step 1: Add the link**

In `app/(main)/layout.tsx`, the nav-links row currently is:
```tsx
<Link href="/" className="nav-link">Home</Link>
<Link href="/feed" className="nav-link">Feed</Link>
<Link href="/browse" className="nav-link">Browse</Link>
<Link href="/about" className="nav-link">About</Link>
```
Add a Tracker link after Feed:
```tsx
<Link href="/" className="nav-link">Home</Link>
<Link href="/feed" className="nav-link">Feed</Link>
<Link href="/tracker" className="nav-link">Tracker</Link>
<Link href="/browse" className="nav-link">Browse</Link>
<Link href="/about" className="nav-link">About</Link>
```
Change ONLY the nav-links row. (`/tracker` redirects logged-out users to sign-in.)

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(main)/layout.tsx"
git commit -m "feat: add Tracker link to main nav"
```

---

## Task 5: Install Anthropic SDK + AI rate limiter

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `lib/rate-limit.ts`

- [ ] **Step 1: Install the SDK**

Run: `npm install @anthropic-ai/sdk`

- [ ] **Step 2: Add a rate limiter for draft generation**

In `lib/rate-limit.ts`, add after `getLoginRateLimit`:

```typescript
export function getAiDraftRateLimit() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "ratelimit:aidraft",
  });
}
```

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json lib/rate-limit.ts
git commit -m "feat: install Anthropic SDK and add AI-draft rate limiter"
```

---

## Task 6: AI prompt builder + generator

**Files:**
- Create: `lib/ai.ts`
- Test: `lib/ai.test.ts`

- [ ] **Step 1: Write the failing test (pure prompt builder)**

Create `lib/ai.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildCoverLetterPrompt } from "./ai";

describe("buildCoverLetterPrompt", () => {
  const profile = {
    name: "Alex Rivera",
    gradeLabel: "Grade 11",
    city: "New York, NY",
    interests: ["Technology", "Science"],
    extracurriculars: ["Robotics Club"],
    skills: ["Python"],
    bio: "Aspiring engineer.",
  };
  const opportunity = {
    title: "Software Engineering Intern",
    org: "Google",
    description: "A summer internship building real products.",
  };

  it("includes the student's name, grade, and the role + org", () => {
    const p = buildCoverLetterPrompt(profile, opportunity);
    expect(p).toContain("Alex Rivera");
    expect(p).toContain("Grade 11");
    expect(p).toContain("Software Engineering Intern");
    expect(p).toContain("Google");
  });

  it("includes interests and extracurriculars so the draft can reference them", () => {
    const p = buildCoverLetterPrompt(profile, opportunity);
    expect(p).toContain("Technology");
    expect(p).toContain("Robotics Club");
  });

  it("handles missing optional fields without crashing", () => {
    const p = buildCoverLetterPrompt(
      { name: null, gradeLabel: null, city: null, interests: [], extracurriculars: [], skills: [], bio: null },
      opportunity
    );
    expect(p).toContain("Software Engineering Intern");
    expect(typeof p).toBe("string");
  });
});
```

- [ ] **Step 2: Run the test to verify it FAILS**

Run: `npm test`
Expected: FAIL — cannot find module `./ai`.

- [ ] **Step 3: Implement**

Create `lib/ai.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";

export interface CoverLetterProfile {
  name: string | null;
  gradeLabel: string | null;
  city: string | null;
  interests: string[];
  extracurriculars: string[];
  skills: string[];
  bio: string | null;
}

export interface CoverLetterOpportunity {
  title: string;
  org: string;
  description: string;
}

// Pure: assembles the user prompt for the cover-letter generation.
export function buildCoverLetterPrompt(
  profile: CoverLetterProfile,
  opportunity: CoverLetterOpportunity
): string {
  const lines: string[] = [];
  lines.push(
    `Write a short, genuine cover letter (about 150-200 words) for a student applying to the following opportunity. ` +
      `Use a warm, authentic voice appropriate for a student — not corporate boilerplate. Do not invent achievements, ` +
      `qualifications, or experiences that aren't given below. If information is missing, keep the letter general rather than fabricating specifics.`
  );
  lines.push("");
  lines.push(`OPPORTUNITY:`);
  lines.push(`- Role: ${opportunity.title}`);
  lines.push(`- Organization: ${opportunity.org}`);
  lines.push(`- Description: ${opportunity.description}`);
  lines.push("");
  lines.push(`STUDENT:`);
  if (profile.name) lines.push(`- Name: ${profile.name}`);
  if (profile.gradeLabel) lines.push(`- Level: ${profile.gradeLabel}`);
  if (profile.city) lines.push(`- Location: ${profile.city}`);
  if (profile.interests.length) lines.push(`- Interests: ${profile.interests.join(", ")}`);
  if (profile.extracurriculars.length) lines.push(`- Extracurriculars: ${profile.extracurriculars.join(", ")}`);
  if (profile.skills.length) lines.push(`- Skills: ${profile.skills.join(", ")}`);
  if (profile.bio) lines.push(`- About: ${profile.bio}`);
  lines.push("");
  lines.push(`Return only the cover letter text — no preamble, no subject line, no placeholders like [Your Name].`);
  return lines.join("\n");
}

// Lazy client so a missing key never crashes at import/build time.
function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function generateCoverLetter(
  profile: CoverLetterProfile,
  opportunity: CoverLetterOpportunity
): Promise<string> {
  const message = await getClient().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: buildCoverLetterPrompt(profile, opportunity) }],
  });
  const text = message.content.find((b) => b.type === "text");
  return text && text.type === "text" ? text.text : "";
}
```

- [ ] **Step 4: Run the test to verify it PASSES**

Run: `npm test`
Expected: PASS (prompt-builder tests; the API function is not exercised by tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ai.ts lib/ai.test.ts
git commit -m "feat: add cover-letter prompt builder and Claude Haiku generator"
```

---

## Task 7: AI draft API route

**Files:**
- Create: `app/api/opportunities/[id]/draft/route.ts`

- [ ] **Step 1: Implement**

Create `app/api/opportunities/[id]/draft/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAiDraftRateLimit } from "@/lib/rate-limit";
import { generateCoverLetter } from "@/lib/ai";
import { OccupationType } from "@prisma/client";

function gradeLabelFor(u: { schoolLevel: string | null; graduationYear: number | null; occupationType: OccupationType | null }): string | null {
  if (u.occupationType === "STUDENT_COLLEGE" || u.schoolLevel === "College") return "College";
  if (u.graduationYear != null) {
    const grade = 12 - (u.graduationYear - new Date().getFullYear());
    if (grade >= 9 && grade <= 12) return `Grade ${grade}`;
  }
  if (u.schoolLevel === "High School" || u.occupationType === "STUDENT_HS") return "Grade 12";
  return null;
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI drafts aren't configured yet." }, { status: 503 });
  }

  const { success } = await getAiDraftRateLimit().limit(session.user.id);
  if (!success) {
    return NextResponse.json({ error: "You've generated a lot of drafts recently. Try again later." }, { status: 429 });
  }

  const { id } = await params;
  const [user, opportunity] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, schoolLevel: true, graduationYear: true, occupationType: true, city: true, interests: true, extracurriculars: true, skills: true, bio: true },
    }),
    db.opportunity.findUnique({
      where: { id },
      select: { title: true, org: true, description: true },
    }),
  ]);

  if (!user || !opportunity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let content: string;
  try {
    content = await generateCoverLetter(
      {
        name: user.name,
        gradeLabel: gradeLabelFor(user),
        city: user.city,
        interests: user.interests,
        extracurriculars: user.extracurriculars,
        skills: user.skills,
        bio: user.bio,
      },
      { title: opportunity.title, org: opportunity.org, description: opportunity.description }
    );
  } catch {
    return NextResponse.json({ error: "Couldn't generate a draft right now. Please try again." }, { status: 502 });
  }

  if (!content) {
    return NextResponse.json({ error: "Couldn't generate a draft right now. Please try again." }, { status: 502 });
  }

  await db.aiDraft.upsert({
    where: { userId_opportunityId: { userId: session.user.id, opportunityId: id } },
    create: { userId: session.user.id, opportunityId: id, content },
    update: { content, generatedAt: new Date() },
  });

  return NextResponse.json({ content });
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: PASS; `/api/opportunities/[id]/draft` appears in the route list.

- [ ] **Step 3: Commit**

```bash
git add "app/api/opportunities/[id]/draft"
git commit -m "feat: add AI cover-letter draft API route (rate-limited, key-guarded)"
```

---

## Task 8: AI assist UI on the opportunity detail page

**Files:**
- Create: `app/(main)/opportunities/[id]/ai-assist.tsx`
- Modify: `app/(main)/opportunities/[id]/page.tsx`

- [ ] **Step 1: Create the client component**

Create `app/(main)/opportunities/[id]/ai-assist.tsx`:

```typescript
"use client";

import { useState } from "react";

export default function AiAssist({
  opportunityId,
  initialDraft,
}: {
  opportunityId: string;
  initialDraft: string | null;
}) {
  const [draft, setDraft] = useState<string>(initialDraft ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}/draft`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setDraft(data.content);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const smallBtn = {
    background: "#e8edf5", color: "#3b5998", border: "1px solid #c8d0e0",
    padding: "3px 10px", fontSize: "10px", borderRadius: "2px", cursor: "pointer", marginRight: "6px",
  };

  return (
    <div style={{ border: "1px solid #c8d0e0", borderRadius: "3px", background: "#fff", marginTop: "10px" }}>
      <div style={{ background: "#3b5998", color: "#fff", padding: "8px 12px", fontSize: "11px", fontWeight: "bold" }}>
        ✨ AI Application Assist
      </div>
      <div style={{ padding: "10px 12px" }}>
        {draft === "" ? (
          <div style={{ fontSize: "11px", color: "#666", marginBottom: "8px" }}>
            Generate a cover-letter draft tailored to your profile and this role.
          </div>
        ) : (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            style={{ width: "100%", boxSizing: "border-box", border: "1px solid #bdc7d8", borderRadius: "2px", fontSize: "11px", padding: "6px", fontFamily: "Arial, Helvetica, sans-serif", lineHeight: 1.5, marginBottom: "8px" }}
          />
        )}

        {error && <div style={{ color: "#c00", fontSize: "11px", marginBottom: "8px" }}>{error}</div>}

        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px" }}>
          <button onClick={generate} disabled={busy} style={{ background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "4px 12px", fontSize: "11px", fontWeight: "bold", borderRadius: "2px", cursor: busy ? "default" : "pointer" }}>
            {busy ? "Generating…" : draft === "" ? "Generate draft →" : "🔄 Regenerate"}
          </button>
          {draft !== "" && (
            <button onClick={copy} style={smallBtn}>{copied ? "✓ Copied" : "📋 Copy"}</button>
          )}
        </div>

        {draft !== "" && (
          <div style={{ fontSize: "9px", color: "#999", marginTop: "8px", lineHeight: 1.4 }}>
            AI-generated from your profile. Always review and personalize before sending.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the detail page**

In `app/(main)/opportunities/[id]/page.tsx`:
1. Add imports:
   ```typescript
   import { db } from "@/lib/db";
   import AiAssist from "./ai-assist";
   ```
2. After the existing `const saveStatus = ...` line, add a fetch of any existing draft:
   ```typescript
   const aiDraft = session?.user?.id
     ? await db.aiDraft.findUnique({
         where: { userId_opportunityId: { userId: session.user.id, opportunityId: listing.id } },
         select: { content: true },
       })
     : null;
   ```
3. In the sidebar, AFTER the closing `</div>` of the "Details" box and the `OpportunityActions`/`Apply Now`/"Sign up to save" block — i.e. as the last element inside the `<div style={{ width: "200px", ... }}>` sidebar wrapper — render the assist for signed-in users:
   ```tsx
   {session?.user?.id && <AiAssist opportunityId={listing.id} initialDraft={aiDraft?.content ?? null} />}
   ```
   Read the file first to place it correctly within the sidebar `<div>`.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/(main)/opportunities/[id]"
git commit -m "feat: add AI cover-letter assist UI to opportunity detail page"
```

---

## Self-Review Notes

- **Spec coverage:** Tracker with Saved/Applying/Applied lanes + deadline warnings → Tasks 1 (`deadlineInfo`/`groupByStatus`), 2 (`getTrackedOpportunities`), 3 (page + status `<select>`). Status change writes a feed event + updates status → reuses the existing `POST /api/opportunities/[id]/save` (which already calls `setSaveStatus` → emits FeedEvents). Tracker nav entry → Task 4. AI assist on the detail page (generate / editable / copy / regenerate, profile-tailored, disclaimer, persisted) → Tasks 5 (SDK + rate limit), 6 (prompt + Haiku call), 7 (route + `AiDraft` upsert), 8 (UI). Model `claude-haiku-4-5`, server-side key, rate-limited → Tasks 5–7.
- **Deferred / out of scope (consistent with prior phases):** an `ACCEPTED` status lane (the Prisma `SaveStatus` enum has only SAVED/APPLYING/APPLIED; acceptance remains a feed-only concept for now); deadline email/push reminders; per-event privacy toggle.
- **Graceful degradation:** the AI route returns 503 with a friendly message when `ANTHROPIC_API_KEY` is unset, so the tracker and the rest of the app work fully without the key; the AI button simply surfaces that message until the key is added.
- **Type consistency:** `TrackerStatus` (`lib/tracker-logic.ts`) = the Prisma `SaveStatus` value set (SAVED/APPLYING/APPLIED) and is the type used by `TrackerCard` and `getTrackedOpportunities`'s grouping. `CoverLetterProfile`/`CoverLetterOpportunity` are defined in `lib/ai.ts` and consumed by the route. `gradeLabelFor` in the draft route mirrors the one in `app/(main)/page.tsx` (kept local — single caller; not worth a shared module yet). The `userId_opportunityId` compound-unique selector matches the Phase 1 `AiDraft` and `SavedOpportunity` `@@unique` constraints.
- **No placeholders:** every code step is complete.
```
