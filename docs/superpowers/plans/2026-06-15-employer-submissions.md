# Employer Opportunity Submissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `EMPLOYER` accounts submit, edit, and delete their own opportunities, screened at write time by a rule-based moderation gate (no human approval), with submissions flowing into the existing browse/feed/matching surfaces.

**Architecture:** Add a nullable `ownerId` to `Opportunity`. A pure, unit-tested `validateSubmission()` runs the content-safety rules; structural validation is Zod; duplicate + rate-limit checks live in the routes. Employer-only pages (`/post`, `/my-postings`, `/post/[id]/edit`) and collection/item API routes enforce an `EMPLOYER` guard. A shared `lib/employer.ts` helper centralizes the employer check.

**Tech Stack:** Next.js 16 (App Router), Prisma 7 (+ `@prisma/adapter-neon`), NextAuth v5 (`auth()`), Zod 4, Vitest, `@upstash/ratelimit`, TypeScript, early-2000s inline-style theme (`#3b5998`).

---

## File Structure

- `prisma/schema.prisma` — MODIFY. Add `Opportunity.ownerId` + relation + index; reverse relation on `User`.
- `lib/moderation.ts` — NEW. Pure `validateSubmission({title, description})`.
- `lib/moderation.test.ts` — NEW. Vitest tests.
- `lib/validations.ts` — MODIFY. Add `opportunitySubmissionSchema`.
- `lib/rate-limit.ts` — MODIFY. Add `getPostRateLimit()`.
- `lib/employer.ts` — NEW. `getEmployerUserId()` helper.
- `lib/opportunities.ts` — MODIFY. Add `getOwnedOpportunities(userId)`.
- `app/api/opportunities/route.ts` — NEW. `POST` (create).
- `app/api/opportunities/[id]/route.ts` — NEW. `PATCH` (edit) + `DELETE`.
- `app/(main)/post/opportunity-form.tsx` — NEW. Shared client form.
- `app/(main)/post/page.tsx` — NEW. Create page (employer-gated).
- `app/(main)/post/[id]/edit/page.tsx` — NEW. Edit page (owner-gated).
- `app/(main)/my-postings/page.tsx` — NEW. Employer dashboard.
- `app/(main)/my-postings/delete-button.tsx` — NEW. Client delete control.
- `app/(main)/layout.tsx` — MODIFY. Employer-conditional nav links.

Shared option lists used by the form (define inline in `opportunity-form.tsx`): grade options `["Grade 9","Grade 10","Grade 11","Grade 12","College"]`; interest options `["Technology","Science","Business","Arts","Politics","Medicine","Law","Environment"]`.

---

## Task 1: Schema — add `ownerId`

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Add the owner relation**

In `model Opportunity`, add after `isPaid Boolean @default(false)` (before `createdAt`):
```prisma
  ownerId         String?
```
And add to the relations block of `Opportunity` (where `savedBy`, `feedEvents`, `aiDrafts` are):
```prisma
  owner      User?              @relation("postedOpportunities", fields: [ownerId], references: [id], onDelete: Cascade)
```
And add the index near the other `@@` lines of `Opportunity` (it currently has none; add it at the end of the model body):
```prisma
  @@index([ownerId])
```

In `model User`, add to the relations list (where `savedOpportunities`, `following`, etc. are):
```prisma
  postedOpportunities Opportunity[] @relation("postedOpportunities")
```

- [ ] **Step 2: Apply to the database**

Run: `npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema." (Additive nullable column — no data loss prompt. If one appears, the table is fine to accept since `ownerId` is nullable and adds no constraint to existing rows.)

- [ ] **Step 3: Verify the client type-checks**

Run: `npx tsc --noEmit`
Expected: PASS. The generated client now has `Opportunity.ownerId` and `User.postedOpportunities`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add ownerId to Opportunity for employer submissions"
```

---

## Task 2: Moderation gate (TDD)

**Files:**
- Create: `lib/moderation.ts`
- Test: `lib/moderation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/moderation.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { validateSubmission } from "./moderation";

const clean = {
  title: "Summer Software Engineering Intern",
  description:
    "Join our engineering team for a 10-week paid summer internship. You will work on real product features alongside senior engineers and ship code to production.",
};

describe("validateSubmission", () => {
  it("accepts a clean submission", () => {
    expect(validateSubmission(clean)).toEqual({ ok: true });
  });

  it("rejects an email address in the description", () => {
    const r = validateSubmission({ ...clean, description: clean.description + " Email me at recruiter@scam.com." });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.toLowerCase()).toContain("contact");
  });

  it("rejects a URL in the description", () => {
    const r = validateSubmission({ ...clean, description: clean.description + " Apply at http://sketchy.example to start." });
    expect(r.ok).toBe(false);
  });

  it("rejects a bare domain in the description", () => {
    const r = validateSubmission({ ...clean, description: clean.description + " Visit sketchy-jobs.net now." });
    expect(r.ok).toBe(false);
  });

  it("rejects a phone number in the title", () => {
    const r = validateSubmission({ ...clean, title: "Intern call 555-123-4567" });
    expect(r.ok).toBe(false);
  });

  it("rejects a banned scam phrase", () => {
    const r = validateSubmission({ ...clean, description: "Great role! Just send a small processing fee to get started." });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.toLowerCase()).toContain("not allowed");
  });

  it("rejects an all-caps title", () => {
    const r = validateSubmission({ ...clean, title: "URGENT HIRING APPLY NOW FAST" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.toLowerCase()).toContain("formatting");
  });

  it("rejects excessive repeated punctuation", () => {
    const r = validateSubmission({ ...clean, title: "Best internship ever!!!!" });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it FAILS**

Run: `npm test`
Expected: FAIL — cannot find module `./moderation`.

- [ ] **Step 3: Implement**

Create `lib/moderation.ts`:
```typescript
export interface ModerationInput {
  title: string;
  description: string;
}

export type ModerationResult = { ok: true } | { ok: false; reason: string };

const URL_RE = /(https?:\/\/|www\.)\S+/i;
const DOMAIN_RE = /\b[a-z0-9][a-z0-9-]*\.(com|net|org|io|co|edu|gov|info|biz|app|dev)\b/i;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const REPEAT_PUNCT_RE = /([!?])\1{2,}/;
const REPEAT_CHAR_RE = /(.)\1{5,}/;

// Phrases commonly used in scam / pay-to-apply / off-platform listings.
const BANNED_PHRASES = [
  "wire transfer",
  "processing fee",
  "registration fee",
  "application fee",
  "pay to apply",
  "gift card",
  "western union",
  "money gram",
  "guaranteed income",
  "guaranteed money",
  "send money",
  "bitcoin",
  "crypto payment",
  "cash app",
  "venmo me",
];

function hasContactInfo(text: string): boolean {
  return URL_RE.test(text) || DOMAIN_RE.test(text) || EMAIL_RE.test(text) || PHONE_RE.test(text);
}

function isMostlyCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 10) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return upper / letters.length > 0.7;
}

export function validateSubmission(input: ModerationInput): ModerationResult {
  const title = input.title ?? "";
  const description = input.description ?? "";
  const haystack = `${title}\n${description}`;
  const lower = haystack.toLowerCase();

  if (hasContactInfo(haystack)) {
    return {
      ok: false,
      reason:
        "Please don't include contact info (links, emails, or phone numbers) in the title or description — use the Apply URL field instead.",
    };
  }

  const banned = BANNED_PHRASES.find((p) => lower.includes(p));
  if (banned) {
    return { ok: false, reason: `This listing contains a phrase that's not allowed ("${banned}").` };
  }

  if (isMostlyCaps(title)) {
    return { ok: false, reason: "Please fix the title's formatting — avoid writing it in all capitals." };
  }

  if (REPEAT_PUNCT_RE.test(haystack) || REPEAT_CHAR_RE.test(haystack)) {
    return { ok: false, reason: "Please fix the formatting — avoid excessive repeated characters or punctuation." };
  }

  return { ok: true };
}
```

- [ ] **Step 4: Run the test to verify it PASSES**

Run: `npm test`
Expected: PASS (existing tests + these 8).

- [ ] **Step 5: Commit**

```bash
git add lib/moderation.ts lib/moderation.test.ts
git commit -m "feat: add rule-based submission moderation gate with tests"
```

---

## Task 3: Submission schema + post rate limiter

**Files:**
- Modify: `lib/validations.ts`
- Modify: `lib/rate-limit.ts`

- [ ] **Step 1: Add the Zod schema**

In `lib/validations.ts`, add at the end:
```typescript
export const opportunitySubmissionSchema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(120),
  org: z.string().trim().min(2, "Organization is too short").max(120),
  type: z.enum(["Jobs", "Internships", "Summer Programs", "Clubs"]),
  location: z.string().trim().min(2, "Location is too short").max(120),
  description: z.string().trim().min(30, "Description should be at least 30 characters").max(4000),
  applyUrl: z.string().trim().url("Apply URL must be a valid link").max(500).optional().or(z.literal("")),
  deadline: z.string().trim().max(60).optional().or(z.literal("")),
  isPaid: z.boolean(),
  targetGrades: z.array(z.string().min(1).max(40)).max(8),
  targetInterests: z.array(z.string().min(1).max(50)).max(5),
});

export type OpportunitySubmissionInput = z.infer<typeof opportunitySubmissionSchema>;
```

- [ ] **Step 2: Add the rate limiter**

In `lib/rate-limit.ts`, add after `getUploadRateLimit`:
```typescript
// Caps how many opportunities a single employer can post per day.
export function getPostRateLimit() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "1 d"),
    prefix: "ratelimit:post",
  });
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/validations.ts lib/rate-limit.ts
git commit -m "feat: add opportunity submission schema and post rate limiter"
```

---

## Task 4: Employer helper + owned-opportunities accessor

**Files:**
- Create: `lib/employer.ts`
- Modify: `lib/opportunities.ts`

- [ ] **Step 1: Create the employer helper**

Create `lib/employer.ts`:
```typescript
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Returns the signed-in user's id if they are an EMPLOYER account, else null.
// Used by employer-only pages/routes/nav to gate access.
export async function getEmployerUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { occupationType: true },
  });
  return user?.occupationType === "EMPLOYER" ? session.user.id : null;
}
```

- [ ] **Step 2: Add the owned-opportunities accessor**

In `lib/opportunities.ts`, add at the end (it already imports `db` and exports `OpportunityView` + `toView` is module-private, so expose a view list here):
```typescript
export async function getOwnedOpportunities(userId: string): Promise<OpportunityView[]> {
  const rows = await db.opportunity.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toView);
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/employer.ts lib/opportunities.ts
git commit -m "feat: add employer guard helper and owned-opportunities accessor"
```

---

## Task 5: Create route (`POST /api/opportunities`)

**Files:** Create `app/api/opportunities/route.ts`

- [ ] **Step 1: Implement**

Create `app/api/opportunities/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { opportunitySubmissionSchema } from "@/lib/validations";
import { validateSubmission } from "@/lib/moderation";
import { getWriteRateLimit, getPostRateLimit } from "@/lib/rate-limit";
import { LABEL_TO_ENUM } from "@/lib/listings";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { occupationType: true, companyName: true },
  });
  if (me?.occupationType !== "EMPLOYER") {
    return NextResponse.json({ error: "Only employer accounts can post opportunities." }, { status: 403 });
  }

  const write = await getWriteRateLimit().limit(session.user.id);
  if (!write.success) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }
  const post = await getPostRateLimit().limit(session.user.id);
  if (!post.success) {
    return NextResponse.json({ error: "You've reached the daily limit for new postings." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = opportunitySubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const data = parsed.data;

  const gate = validateSubmission({ title: data.title, description: data.description });
  if (!gate.ok) {
    return NextResponse.json({ error: gate.reason }, { status: 400 });
  }

  // Duplicate guard: same owner + same title + org (case-insensitive).
  const dup = await db.opportunity.findFirst({
    where: {
      ownerId: session.user.id,
      title: { equals: data.title, mode: "insensitive" },
      org: { equals: data.org, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (dup) {
    return NextResponse.json({ error: "You already have a posting with this title and organization." }, { status: 400 });
  }

  const created = await db.opportunity.create({
    data: {
      title: data.title,
      org: data.org,
      type: LABEL_TO_ENUM[data.type],
      location: data.location,
      description: data.description,
      tags: [],
      deadline: data.deadline ? data.deadline : null,
      applyUrl: data.applyUrl ? data.applyUrl : null,
      targetGrades: data.targetGrades,
      targetInterests: data.targetInterests,
      isPaid: data.isPaid,
      ownerId: session.user.id,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: created.id });
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: PASS; `/api/opportunities` appears in the route list.

- [ ] **Step 3: Commit**

```bash
git add app/api/opportunities/route.ts
git commit -m "feat: add employer opportunity create route with moderation gate"
```

---

## Task 6: Edit + delete route (`/api/opportunities/[id]`)

**Files:** Create `app/api/opportunities/[id]/route.ts`

- [ ] **Step 1: Implement**

Create `app/api/opportunities/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { opportunitySubmissionSchema } from "@/lib/validations";
import { validateSubmission } from "@/lib/moderation";
import { getWriteRateLimit } from "@/lib/rate-limit";
import { LABEL_TO_ENUM } from "@/lib/listings";

async function loadOwned(userId: string, id: string) {
  const opp = await db.opportunity.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  if (!opp) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (opp.ownerId !== userId) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { ok: true as const };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const owned = await loadOwned(session.user.id, id);
  if ("error" in owned) return owned.error;

  const { success } = await getWriteRateLimit().limit(session.user.id);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = opportunitySubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const data = parsed.data;

  const gate = validateSubmission({ title: data.title, description: data.description });
  if (!gate.ok) {
    return NextResponse.json({ error: gate.reason }, { status: 400 });
  }

  const dup = await db.opportunity.findFirst({
    where: {
      ownerId: session.user.id,
      id: { not: id },
      title: { equals: data.title, mode: "insensitive" },
      org: { equals: data.org, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (dup) {
    return NextResponse.json({ error: "You already have another posting with this title and organization." }, { status: 400 });
  }

  await db.opportunity.update({
    where: { id },
    data: {
      title: data.title,
      org: data.org,
      type: LABEL_TO_ENUM[data.type],
      location: data.location,
      description: data.description,
      deadline: data.deadline ? data.deadline : null,
      applyUrl: data.applyUrl ? data.applyUrl : null,
      targetGrades: data.targetGrades,
      targetInterests: data.targetInterests,
      isPaid: data.isPaid,
    },
  });

  return NextResponse.json({ id });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const owned = await loadOwned(session.user.id, id);
  if ("error" in owned) return owned.error;

  await db.opportunity.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: PASS; `/api/opportunities/[id]` appears as a route alongside its `save`/`draft` sub-routes.

- [ ] **Step 3: Commit**

```bash
git add "app/api/opportunities/[id]/route.ts"
git commit -m "feat: add employer opportunity edit/delete route (owner-only)"
```

---

## Task 7: Shared form + create page

**Files:**
- Create: `app/(main)/post/opportunity-form.tsx`
- Create: `app/(main)/post/page.tsx`

- [ ] **Step 1: Create the shared form component**

Create `app/(main)/post/opportunity-form.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TYPES = ["Jobs", "Internships", "Summer Programs", "Clubs"] as const;
const GRADES = ["Grade 9", "Grade 10", "Grade 11", "Grade 12", "College"];
const INTERESTS = ["Technology", "Science", "Business", "Arts", "Politics", "Medicine", "Law", "Environment"];

export interface OpportunityFormValues {
  title: string;
  org: string;
  type: (typeof TYPES)[number];
  location: string;
  description: string;
  applyUrl: string;
  deadline: string;
  isPaid: boolean;
  targetGrades: string[];
  targetInterests: string[];
}

export default function OpportunityForm({
  mode,
  opportunityId,
  initial,
}: {
  mode: "create" | "edit";
  opportunityId?: string;
  initial: OpportunityFormValues;
}) {
  const router = useRouter();
  const [v, setV] = useState<OpportunityFormValues>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function toggle(list: string[], item: string, max?: number): string[] {
    if (list.includes(item)) return list.filter((x) => x !== item);
    if (max && list.length >= max) return list;
    return [...list, item];
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const url = mode === "create" ? "/api/opportunities" : `/api/opportunities/${opportunityId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Please check the fields and try again.");
        return;
      }
      router.push("/my-postings");
    } finally {
      setBusy(false);
    }
  }

  const label = { display: "block" as const, fontSize: "12px", fontWeight: "bold" as const, color: "#333", margin: "0 0 4px" };
  const input = { width: "100%", boxSizing: "border-box" as const, border: "1px solid #bdc7d8", padding: "5px 7px", fontSize: "13px", borderRadius: "2px" };
  const chip = (active: boolean) => ({ background: active ? "#3b5998" : "#e8edf5", color: active ? "#fff" : "#3b5998", border: active ? "1px solid #29487d" : "1px solid #c8d0e0", borderRadius: "2px", padding: "3px 9px", fontSize: "12px", cursor: "pointer" as const });
  const field = { marginBottom: "12px" };

  return (
    <form onSubmit={submit} style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      {error && (
        <div style={{ background: "#fff3f3", border: "1px solid #f5c6cb", color: "#c00", fontSize: "12px", padding: "7px 9px", borderRadius: "2px", marginBottom: "12px" }}>{error}</div>
      )}

      <div style={field}>
        <label htmlFor="title" style={label}>Title</label>
        <input id="title" style={input} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
      </div>
      <div style={field}>
        <label htmlFor="org" style={label}>Organization</label>
        <input id="org" style={input} value={v.org} onChange={(e) => setV({ ...v, org: e.target.value })} />
      </div>
      <div style={field}>
        <label htmlFor="type" style={label}>Type</label>
        <select id="type" style={input} value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as OpportunityFormValues["type"] })}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div style={field}>
        <label htmlFor="location" style={label}>Location</label>
        <input id="location" style={input} value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} placeholder="City, State or Remote" />
      </div>
      <div style={field}>
        <label htmlFor="description" style={label}>Description</label>
        <textarea id="description" rows={6} style={{ ...input, lineHeight: 1.5 }} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        <div style={{ fontSize: "10px", color: "#999", marginTop: "3px" }}>No links, emails, or phone numbers here — use the Apply URL field below.</div>
      </div>
      <div style={field}>
        <label htmlFor="applyUrl" style={label}>Apply URL <span style={{ fontWeight: "normal", color: "#666" }}>(optional)</span></label>
        <input id="applyUrl" style={input} value={v.applyUrl} onChange={(e) => setV({ ...v, applyUrl: e.target.value })} placeholder="https://..." />
      </div>
      <div style={field}>
        <label htmlFor="deadline" style={label}>Deadline <span style={{ fontWeight: "normal", color: "#666" }}>(optional)</span></label>
        <input id="deadline" style={input} value={v.deadline} onChange={(e) => setV({ ...v, deadline: e.target.value })} placeholder="e.g. March 1, 2026" />
      </div>
      <div style={field}>
        <label style={{ ...label, display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
          <input type="checkbox" checked={v.isPaid} onChange={(e) => setV({ ...v, isPaid: e.target.checked })} style={{ accentColor: "#3b5998" }} />
          This opportunity is paid
        </label>
      </div>
      <div style={field}>
        <div style={label}>Eligible grades</div>
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {GRADES.map((g) => (
            <span key={g} style={chip(v.targetGrades.includes(g))} onClick={() => setV({ ...v, targetGrades: toggle(v.targetGrades, g) })}>{g}</span>
          ))}
        </div>
      </div>
      <div style={field}>
        <div style={label}>Related interests <span style={{ fontWeight: "normal", color: "#666" }}>(up to 5)</span></div>
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {INTERESTS.map((i) => (
            <span key={i} style={chip(v.targetInterests.includes(i))} onClick={() => setV({ ...v, targetInterests: toggle(v.targetInterests, i, 5) })}>{i}</span>
          ))}
        </div>
      </div>

      <button type="submit" disabled={busy} style={{ width: "100%", background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "7px", fontSize: "13px", fontWeight: "bold", borderRadius: "2px", cursor: busy ? "default" : "pointer" }}>
        {busy ? "Saving…" : mode === "create" ? "Post opportunity" : "Save changes"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create the create page**

Create `app/(main)/post/page.tsx`:
```typescript
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import OpportunityForm, { type OpportunityFormValues } from "./opportunity-form";

export const dynamic = "force-dynamic";

export default async function PostPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/post");
  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { occupationType: true, companyName: true },
  });
  if (me?.occupationType !== "EMPLOYER") redirect("/");

  const initial: OpportunityFormValues = {
    title: "",
    org: me.companyName ?? "",
    type: "Internships",
    location: "",
    description: "",
    applyUrl: "",
    deadline: "",
    isPaid: false,
    targetGrades: [],
    targetInterests: [],
  };

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto", padding: "12px 16px", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ fontSize: "16px", fontWeight: "bold", color: "#3b5998", marginBottom: "10px" }}>Post an Opportunity</div>
      <OpportunityForm mode="create" initial={initial} />
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: PASS; `/post` appears as dynamic `ƒ`.

- [ ] **Step 4: Commit**

```bash
git add "app/(main)/post/opportunity-form.tsx" "app/(main)/post/page.tsx"
git commit -m "feat: add employer opportunity post form and create page"
```

---

## Task 8: My Postings dashboard

**Files:**
- Create: `app/(main)/my-postings/delete-button.tsx`
- Create: `app/(main)/my-postings/page.tsx`

- [ ] **Step 1: Create the delete control**

Create `app/(main)/my-postings/delete-button.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteButton({ opportunityId }: { opportunityId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("Delete this posting? This can't be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={remove} disabled={busy} style={{ background: "#fff", color: "#c00", border: "1px solid #e0b4b4", padding: "2px 8px", fontSize: "10px", borderRadius: "2px", cursor: busy ? "default" : "pointer" }}>
      {busy ? "…" : "Delete"}
    </button>
  );
}
```

- [ ] **Step 2: Create the dashboard page**

Create `app/(main)/my-postings/page.tsx`:
```typescript
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedOpportunities } from "@/lib/opportunities";
import { TYPE_LABELS } from "@/lib/listings";
import DeleteButton from "./delete-button";

export const dynamic = "force-dynamic";

export default async function MyPostingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/my-postings");
  const me = await db.user.findUnique({ where: { id: session.user.id }, select: { occupationType: true } });
  if (me?.occupationType !== "EMPLOYER") redirect("/");

  const items = await getOwnedOpportunities(session.user.id);

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "12px 16px", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <div style={{ fontSize: "16px", fontWeight: "bold", color: "#3b5998" }}>My Postings</div>
        <Link href="/post" style={{ background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "4px 10px", fontSize: "12px", fontWeight: "bold", borderRadius: "2px", textDecoration: "none" }}>+ Post new</Link>
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize: "12px", color: "#666", border: "1px solid #c8d0e0", borderRadius: "3px", background: "#fff", padding: "16px" }}>
          You haven&apos;t posted anything yet. <Link href="/post" style={{ color: "#3b5998" }}>Post your first opportunity</Link>.
        </div>
      ) : (
        items.map((o) => (
          <div key={o.id} style={{ border: "1px solid #c8d0e0", borderRadius: "3px", background: "#fff", padding: "9px 12px", marginBottom: "5px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
              <div style={{ minWidth: 0 }}>
                <Link href={`/opportunities/${o.id}`} style={{ color: "#3b5998", fontWeight: "bold", fontSize: "13px", textDecoration: "none" }}>{o.title}</Link>
                <div style={{ fontSize: "11px", color: "#666" }}>{o.org} · {o.location} · {TYPE_LABELS[o.type]}</div>
              </div>
              <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                <Link href={`/post/${o.id}/edit`} style={{ background: "#e8edf5", color: "#3b5998", border: "1px solid #c8d0e0", padding: "2px 8px", fontSize: "10px", borderRadius: "2px", textDecoration: "none" }}>Edit</Link>
                <DeleteButton opportunityId={o.id} />
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: PASS; `/my-postings` appears as dynamic `ƒ`.

- [ ] **Step 4: Commit**

```bash
git add "app/(main)/my-postings"
git commit -m "feat: add My Postings employer dashboard with delete"
```

---

## Task 9: Edit page

**Files:** Create `app/(main)/post/[id]/edit/page.tsx`

- [ ] **Step 1: Implement**

Create `app/(main)/post/[id]/edit/page.tsx`:
```typescript
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ENUM_TO_LABEL } from "@/lib/listings";
import OpportunityForm, { type OpportunityFormValues } from "../../opportunity-form";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/my-postings");
  const me = await db.user.findUnique({ where: { id: session.user.id }, select: { occupationType: true } });
  if (me?.occupationType !== "EMPLOYER") redirect("/");

  const { id } = await params;
  const o = await db.opportunity.findUnique({ where: { id } });
  if (!o) notFound();
  if (o.ownerId !== session.user.id) redirect("/my-postings");

  const initial: OpportunityFormValues = {
    title: o.title,
    org: o.org,
    type: ENUM_TO_LABEL[o.type],
    location: o.location,
    description: o.description,
    applyUrl: o.applyUrl ?? "",
    deadline: o.deadline ?? "",
    isPaid: o.isPaid,
    targetGrades: o.targetGrades,
    targetInterests: o.targetInterests,
  };

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto", padding: "12px 16px", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ fontSize: "16px", fontWeight: "bold", color: "#3b5998", marginBottom: "10px" }}>Edit Posting</div>
      <OpportunityForm mode="edit" opportunityId={o.id} initial={initial} />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: PASS; `/post/[id]/edit` appears as dynamic `ƒ`.

- [ ] **Step 3: Commit**

```bash
git add "app/(main)/post/[id]"
git commit -m "feat: add employer opportunity edit page"
```

---

## Task 10: Employer-conditional nav links

**Files:** Modify `app/(main)/layout.tsx`

- [ ] **Step 1: Make the layout employer-aware**

`app/(main)/layout.tsx` is a server component. At the top of the default export function, add a session+employer lookup, then render the extra links conditionally. Add the import and the lookup:
```typescript
import { getEmployerUserId } from "@/lib/employer";
```
Inside the component body (make it `async` if it isn't already), before the `return`:
```typescript
  const isEmployer = (await getEmployerUserId()) !== null;
```
In the nav-links row, after the `About` link, conditionally add the employer links:
```tsx
{isEmployer && <Link href="/post" className="nav-link">Post</Link>}
{isEmployer && <Link href="/my-postings" className="nav-link">My Postings</Link>}
```
(If the layout default export is not already `async`, change `export default function MainLayout(` to `export default async function MainLayout(`.)

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(main)/layout.tsx"
git commit -m "feat: show Post / My Postings nav links to employers"
```

---

## Self-Review Notes

- **Spec coverage:** `ownerId` data model → Task 1. Pure rule-based gate (contact-info, blocklist, spam heuristics) → Task 2; structural validation → Task 3 (`opportunitySubmissionSchema`); duplicate guard + rate limit → Tasks 5/6 routes + Task 3 (`getPostRateLimit`). Employer gate helper → Task 4. Owned-list accessor → Task 4. Create/edit/delete routes with auth+employer+owner checks → Tasks 5, 6. Post form, my-postings dashboard, edit page → Tasks 7, 8, 9. Employer-conditional nav → Task 10. Integration (browse/feed/matching) needs no work — submitted rows flow through the existing accessors.
- **Refinement from spec:** the spec listed "required + length sanity" as moderation rule 1; in the plan that structural validation is owned by Zod (`opportunitySubmissionSchema`, Task 3) and the pure `validateSubmission` (Task 2) handles only the content-safety rules (contact-info, blocklist, spam heuristics). Cleaner separation, same coverage, no double-maintenance.
- **Type consistency:** the form, routes, and schema all use the friendly type labels (`"Jobs" | "Internships" | "Summer Programs" | "Clubs"`); the routes map to the Prisma enum via `LABEL_TO_ENUM` and the edit page maps back via `ENUM_TO_LABEL`. `OpportunityFormValues` is defined once in `opportunity-form.tsx` and imported by both the create and edit pages. `getEmployerUserId` (Task 4) is used by the nav (Task 10); the routes do their own inline 401/403 split (they need to distinguish not-logged-in from non-employer).
- **No placeholders:** every code step is complete.
