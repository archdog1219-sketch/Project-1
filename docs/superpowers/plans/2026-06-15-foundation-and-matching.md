# Foundation + Phase 1 (Smart Matching) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the database foundation for all three differentiation phases, move opportunities from hardcoded data into the database, and ship Phase 1 — a profile-based "For You" matching tab on the home page.

**Architecture:** Extend the Prisma schema with the six tables from the spec (only User fields + Opportunity are *used* this phase; the others are created empty so Phases 2–3 are additive). Seed the Opportunity table from the current `lib/listings.ts` data and read opportunities from the DB. Matching is a pure, deterministic scoring function (no ML) that is unit-tested with Vitest. The home page becomes a server component that loads opportunities + the signed-in user's profile, scores them, and hands them to the existing client UI which gains a "For You" tab.

**Tech Stack:** Next.js 16 (App Router), Prisma 7 (+ `@prisma/adapter-neon`), NextAuth v5 (`auth()`), Zod 4, Vitest (new, for the scorer), TypeScript, inline-styled React (early-2000s theme).

---

## File Structure

- `prisma/schema.prisma` — add User matching fields + `Opportunity`, `SavedOpportunity`, `Follow`, `FeedEvent`, `AiDraft` models, and a `GpaRange`/`OpportunityType`/`SaveStatus`/`FeedEventType` enum set.
- `prisma/seed-opportunities.ts` — one-off script that inserts the existing listings into the `Opportunity` table.
- `lib/listings.ts` — keep the `OpportunityType`/`TYPE_LABELS`/`OPPORTUNITY_TYPES` constants and the `Listing` type; remove the hardcoded `LISTINGS` array (moves to DB seed).
- `lib/opportunities.ts` — NEW. DB accessors: `getAllOpportunities()`, `getOpportunityById(id)`.
- `lib/matching.ts` — NEW. Pure scorer: `scoreOpportunity(profile, opportunity)` and `rankForUser(profile, opportunities)`.
- `lib/matching.test.ts` — NEW. Vitest unit tests for the scorer.
- `vitest.config.ts` — NEW. Vitest config.
- `lib/validations.ts` — add `matchingProfileSchema`.
- `app/api/user/onboarding/matching/route.ts` — NEW. PATCH endpoint saving GPA + interests + extracurriculars.
- `app/onboarding/matching/page.tsx` — NEW. The extended onboarding step.
- `app/(main)/page.tsx` — convert to a server component that loads + scores data, delegates UI to a new client component.
- `app/(main)/home-client.tsx` — NEW. The interactive home UI (tabs + filters + cards), extracted from the current page with a "For You" tab added.
- `app/(main)/browse/page.tsx` — switch its data source from `LISTINGS` to `getAllOpportunities()`.
- `app/(main)/opportunities/[id]/page.tsx` — switch from `LISTINGS.find` to `getOpportunityById(id)`.

---

## Task 1: Extend the Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums and User matching fields**

Add these enums after the existing `OccupationType` enum:

```prisma
enum GpaRange {
  BELOW_3_0
  R3_0_3_5
  R3_5_3_8
  R3_8_PLUS
}

enum OpportunityType {
  JOB
  INTERNSHIP
  SUMMER_PROGRAM
  CLUB
}

enum SaveStatus {
  SAVED
  APPLYING
  APPLIED
}

enum FeedEventType {
  SAVED
  APPLIED
  ACCEPTED
}
```

In `model User`, add these fields after `interests String[]`:

```prisma
  gpaRange         GpaRange?
  extracurriculars String[]
  careerGoals      String?
```

And add these relation fields after the existing `sessions  Session[]` line:

```prisma
  savedOpportunities SavedOpportunity[]
  following          Follow[]           @relation("follower")
  followers          Follow[]           @relation("following")
  feedEvents         FeedEvent[]
  aiDrafts           AiDraft[]
```

- [ ] **Step 2: Add the new models**

Append to the end of `prisma/schema.prisma`:

```prisma
model Opportunity {
  id              String          @id @default(cuid())
  title           String
  org             String
  type            OpportunityType
  location        String
  description     String
  tags            String[]
  deadline        String?
  applyUrl        String?
  targetGrades    String[]
  targetInterests String[]
  isPaid          Boolean         @default(false)
  createdAt       DateTime        @default(now())

  savedBy    SavedOpportunity[]
  feedEvents FeedEvent[]
  aiDrafts   AiDraft[]
}

model SavedOpportunity {
  id            String     @id @default(cuid())
  userId        String
  opportunityId String
  status        SaveStatus @default(SAVED)
  notes         String?
  savedAt       DateTime   @default(now())

  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  opportunity Opportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)

  @@unique([userId, opportunityId])
  @@index([userId])
}

model Follow {
  id          String   @id @default(cuid())
  followerId  String
  followingId String
  createdAt   DateTime @default(now())

  follower  User @relation("follower", fields: [followerId], references: [id], onDelete: Cascade)
  following User @relation("following", fields: [followingId], references: [id], onDelete: Cascade)

  @@unique([followerId, followingId])
  @@index([followingId])
}

model FeedEvent {
  id            String        @id @default(cuid())
  actorId       String
  type          FeedEventType
  opportunityId String
  createdAt     DateTime      @default(now())

  actor       User        @relation(fields: [actorId], references: [id], onDelete: Cascade)
  opportunity Opportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)

  @@index([actorId])
}

model AiDraft {
  id            String   @id @default(cuid())
  userId        String
  opportunityId String
  content       String
  generatedAt   DateTime @default(now())

  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  opportunity Opportunity @relation(fields: [opportunityId], references: [id], onDelete: Cascade)

  @@unique([userId, opportunityId])
}
```

- [ ] **Step 3: Apply the migration**

Run: `npx prisma migrate dev --name add_matching_and_opportunity_models`
Expected: Prisma creates the migration, applies it to the database, and regenerates the client. Output ends with "Your database is now in sync with your schema."

If the environment uses `db push` instead of migrations (no `prisma/migrations/` dir), run `npx prisma db push` then `npx prisma generate`.

- [ ] **Step 4: Verify the client type-checks**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). The generated client now exports `Opportunity`, `SavedOpportunity`, `GpaRange`, `OpportunityType`, etc.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add Opportunity + matching/feed/draft models to schema"
```

---

## Task 2: Seed opportunities into the DB and add accessors

**Files:**
- Modify: `lib/listings.ts`
- Create: `prisma/seed-opportunities.ts`
- Create: `lib/opportunities.ts`

- [ ] **Step 1: Reduce `lib/listings.ts` to shared constants**

Replace the entire contents of `lib/listings.ts` with the type + constants only (the data moves to the seed). Note `type` becomes the Prisma enum value at the DB layer, but the UI still uses the friendly strings, so keep the label map keyed by the friendly union:

```typescript
export type OpportunityTypeLabel = "Jobs" | "Internships" | "Summer Programs" | "Clubs";

export const OPPORTUNITY_TYPES: OpportunityTypeLabel[] = [
  "Jobs",
  "Internships",
  "Summer Programs",
  "Clubs",
];

export const TYPE_LABELS: Record<OpportunityTypeLabel, string> = {
  Jobs: "Job",
  Internships: "Internship",
  "Summer Programs": "Summer",
  Clubs: "Club",
};

// Maps the friendly UI label <-> the Prisma OpportunityType enum.
export const LABEL_TO_ENUM: Record<OpportunityTypeLabel, "JOB" | "INTERNSHIP" | "SUMMER_PROGRAM" | "CLUB"> = {
  Jobs: "JOB",
  Internships: "INTERNSHIP",
  "Summer Programs": "SUMMER_PROGRAM",
  Clubs: "CLUB",
};

export const ENUM_TO_LABEL: Record<"JOB" | "INTERNSHIP" | "SUMMER_PROGRAM" | "CLUB", OpportunityTypeLabel> = {
  JOB: "Jobs",
  INTERNSHIP: "Internships",
  SUMMER_PROGRAM: "Summer Programs",
  CLUB: "Clubs",
};
```

- [ ] **Step 2: Write the seed script**

Create `prisma/seed-opportunities.ts`. It seeds the nine demo opportunities (the originals, plus the new `targetGrades`/`targetInterests`/`isPaid` matching fields) and is safe to re-run (clears the table first):

```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const OPPORTUNITIES = [
  { title: "Software Engineering Intern", org: "Google", type: "INTERNSHIP" as const, location: "Remote", description: "Join Google's engineering team for a 12-week summer internship working alongside full-time engineers on real products.", deadline: "January 15, 2026", applyUrl: "#", targetGrades: ["Grade 11", "Grade 12", "College"], targetInterests: ["Technology"], isPaid: true, tags: ["Paid", "Summer 2026"] },
  { title: "STEM Residential Program", org: "MIT", type: "SUMMER_PROGRAM" as const, location: "Cambridge, MA", description: "A 6-week residential summer program at MIT for high school students passionate about science and engineering.", deadline: "March 1, 2026", applyUrl: "#", targetGrades: ["Grade 10", "Grade 11", "Grade 12"], targetInterests: ["Science", "Technology"], isPaid: false, tags: ["Residential", "Grades 10–12"] },
  { title: "Marketing & Strategy Club", org: "Yale University", type: "CLUB" as const, location: "New Haven, CT", description: "Yale's student-run marketing club works with real nonprofits and startups on branding, strategy, and growth campaigns.", deadline: null, applyUrl: "#", targetGrades: ["College"], targetInterests: ["Business"], isPaid: false, tags: ["Extracurricular", "All grades"] },
  { title: "Retail Associate", org: "Target", type: "JOB" as const, location: "New York, NY", description: "Part-time retail associate role. Flexible scheduling works around school. Benefits include employee discount and tuition assistance.", deadline: null, applyUrl: "#", targetGrades: ["Grade 11", "Grade 12", "College"], targetInterests: ["Business"], isPaid: true, tags: ["Part-time", "$17/hr"] },
  { title: "Data Science Intern", org: "Meta", type: "INTERNSHIP" as const, location: "Menlo Park, CA", description: "Work on Meta's data science team to analyze product metrics, build dashboards, and run experiments. Strong Python and SQL skills required.", deadline: "December 1, 2025", applyUrl: "#", targetGrades: ["College"], targetInterests: ["Technology", "Science"], isPaid: true, tags: ["Paid", "Summer 2026"] },
  { title: "Congressional Internship", org: "U.S. House of Representatives", type: "INTERNSHIP" as const, location: "Washington, D.C.", description: "Intern in a congressional office during the spring or summer session. Constituent correspondence, legislative research, committee hearings.", deadline: "February 28, 2026", applyUrl: "#", targetGrades: ["College"], targetInterests: ["Politics", "Law"], isPaid: false, tags: ["Unpaid", "College students"] },
  { title: "Robotics Club", org: "Stanford University", type: "CLUB" as const, location: "Stanford, CA", description: "Stanford's undergraduate robotics club competes in national competitions and builds autonomous systems from scratch.", deadline: null, applyUrl: "#", targetGrades: ["College"], targetInterests: ["Technology", "Science"], isPaid: false, tags: ["STEM", "All grades"] },
  { title: "Young Entrepreneurs Program", org: "Babson College", type: "SUMMER_PROGRAM" as const, location: "Wellesley, MA", description: "A 2-week intensive entrepreneurship program for high school students. Develop a business idea, build a prototype, pitch to investors.", deadline: "April 15, 2026", applyUrl: "#", targetGrades: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"], targetInterests: ["Business"], isPaid: false, tags: ["Residential", "Grades 9–12"] },
  { title: "Barista", org: "Starbucks", type: "JOB" as const, location: "Various locations", description: "Part-time barista positions nationwide. Benefits include free coffee, health insurance (20+ hrs/week), and tuition reimbursement.", deadline: null, applyUrl: "#", targetGrades: ["Grade 11", "Grade 12", "College"], targetInterests: ["Business"], isPaid: true, tags: ["Part-time", "Benefits"] },
];

async function main() {
  await db.opportunity.deleteMany();
  for (const o of OPPORTUNITIES) {
    await db.opportunity.create({ data: o });
  }
  console.log(`Seeded ${OPPORTUNITIES.length} opportunities.`);
}

main().finally(() => process.exit(0));
```

- [ ] **Step 2b: Run the seed**

Run: `npx tsx prisma/seed-opportunities.ts`
Expected: prints `Seeded 9 opportunities.` (If `tsx` is not installed, run `npx tsx@latest prisma/seed-opportunities.ts`.)

- [ ] **Step 3: Write the DB accessors**

Create `lib/opportunities.ts`. Returns rows mapped to the UI shape (enum → friendly label) so existing card components need minimal change:

```typescript
import { db } from "@/lib/db";
import { ENUM_TO_LABEL, type OpportunityTypeLabel } from "@/lib/listings";

export interface OpportunityView {
  id: string;
  title: string;
  org: string;
  type: OpportunityTypeLabel;
  location: string;
  description: string;
  tags: string[];
  deadline: string | null;
  applyUrl: string | null;
  targetGrades: string[];
  targetInterests: string[];
  isPaid: boolean;
}

function toView(o: {
  id: string; title: string; org: string; type: keyof typeof ENUM_TO_LABEL;
  location: string; description: string; tags: string[]; deadline: string | null;
  applyUrl: string | null; targetGrades: string[]; targetInterests: string[]; isPaid: boolean;
}): OpportunityView {
  return { ...o, type: ENUM_TO_LABEL[o.type] };
}

export async function getAllOpportunities(): Promise<OpportunityView[]> {
  const rows = await db.opportunity.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(toView);
}

export async function getOpportunityById(id: string): Promise<OpportunityView | null> {
  const row = await db.opportunity.findUnique({ where: { id } });
  return row ? toView(row) : null;
}
```

- [ ] **Step 4: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS. (Errors in `browse/page.tsx`, `opportunities/[id]/page.tsx`, and `(main)/page.tsx` are expected here because they still import the removed `LISTINGS` — Tasks 5–7 fix them. If you want a clean checkpoint, do Steps 5–7 of this task next before committing.)

- [ ] **Step 5: Point the detail page at the DB**

In `app/(main)/opportunities/[id]/page.tsx`, replace the `LISTINGS`/`TYPE_LABELS` import line with:

```typescript
import { TYPE_LABELS } from "@/lib/listings";
import { getOpportunityById } from "@/lib/opportunities";
```

Remove `export function generateStaticParams()` entirely (data is now dynamic). Replace the body lookup:

```typescript
export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getOpportunityById(id);
  if (!listing) notFound();
  // ...rest unchanged...
```

- [ ] **Step 6: Point the browse page at the DB**

`app/(main)/browse/page.tsx` is a client component. Split it: make `browse/page.tsx` a server component that loads data and renders a new client child. Create `app/(main)/browse/browse-client.tsx` containing the current client component body (everything from `"use client"` down), changing its signature to accept `{ listings }: { listings: OpportunityView[] }` and using `listings` instead of `LISTINGS`. Then replace `browse/page.tsx` with:

```typescript
import { getAllOpportunities } from "@/lib/opportunities";
import BrowseClient from "./browse-client";

export default async function BrowsePage() {
  const listings = await getAllOpportunities();
  return <BrowseClient listings={listings} />;
}
```

In `browse-client.tsx`, update imports: drop `LISTINGS`, import `OPPORTUNITY_TYPES, TYPE_LABELS` from `@/lib/listings` and `type OpportunityView` from `@/lib/opportunities`, change the `useState` filter source and the `.filter(...)` to operate on the `listings` prop, and change `OpportunityType` references to `OpportunityTypeLabel`.

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: PASS. `/opportunities/[id]` now shows as `ƒ (Dynamic)` instead of SSG.

- [ ] **Step 8: Commit**

```bash
git add lib/listings.ts lib/opportunities.ts prisma/seed-opportunities.ts "app/(main)/opportunities/[id]/page.tsx" "app/(main)/browse"
git commit -m "feat: move opportunities into the database with seed + accessors"
```

---

## Task 3: Matching scorer (TDD with Vitest)

**Files:**
- Create: `vitest.config.ts`
- Create: `lib/matching.ts`
- Test: `lib/matching.test.ts`

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest`
Then add to `package.json` `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 2: Add Vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { environment: "node" },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

- [ ] **Step 3: Write the failing test**

Create `lib/matching.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { scoreOpportunity, rankForUser, type MatchProfile } from "./matching";
import type { OpportunityView } from "./opportunities";

const profile: MatchProfile = {
  gradeLabel: "Grade 11",
  location: "New York, NY",
  interests: ["Technology", "Science"],
};

function opp(over: Partial<OpportunityView>): OpportunityView {
  return {
    id: "x", title: "T", org: "O", type: "Internships", location: "Remote",
    description: "", tags: [], deadline: null, applyUrl: null,
    targetGrades: ["Grade 11"], targetInterests: ["Technology"], isPaid: false, ...over,
  };
}

describe("scoreOpportunity", () => {
  it("gives interest-overlap points and reports the interest reason", () => {
    const r = scoreOpportunity(profile, opp({ targetInterests: ["Technology", "Science"], targetGrades: [] }));
    expect(r.score).toBeGreaterThan(0);
    expect(r.reason).toBe("Matches your interests");
  });

  it("reports grade eligibility when the grade matches and interests do not", () => {
    const r = scoreOpportunity(profile, opp({ targetInterests: ["Law"], targetGrades: ["Grade 11"] }));
    expect(r.score).toBeGreaterThan(0);
    expect(r.reason).toBe("Grade 11 eligible");
  });

  it("treats empty targetGrades as open to all grades", () => {
    const r = scoreOpportunity(profile, opp({ targetGrades: [], targetInterests: ["Law"] }));
    expect(r.reason).toBe("Open to all grades");
    expect(r.score).toBeGreaterThan(0);
  });

  it("gives a location point and reason for Remote", () => {
    const r = scoreOpportunity(
      { ...profile, interests: [] },
      opp({ location: "Remote", targetGrades: [], targetInterests: [] })
    );
    expect(r.reason).toBe("Remote-friendly");
  });

  it("scores higher when more signals match", () => {
    const strong = scoreOpportunity(profile, opp({ targetInterests: ["Technology", "Science"], targetGrades: ["Grade 11"], location: "New York, NY" }));
    const weak = scoreOpportunity(profile, opp({ targetInterests: ["Law"], targetGrades: ["College"], location: "Boston, MA" }));
    expect(strong.score).toBeGreaterThan(weak.score);
  });
});

describe("rankForUser", () => {
  it("sorts opportunities by descending score", () => {
    const ranked = rankForUser(profile, [
      opp({ id: "weak", targetInterests: ["Law"], targetGrades: ["College"], location: "Boston, MA" }),
      opp({ id: "strong", targetInterests: ["Technology"], targetGrades: ["Grade 11"], location: "New York, NY" }),
    ]);
    expect(ranked[0].opportunity.id).toBe("strong");
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './matching'` (the file does not exist yet).

- [ ] **Step 5: Implement the scorer**

Create `lib/matching.ts`:

```typescript
import type { OpportunityView } from "./opportunities";

export interface MatchProfile {
  gradeLabel: string | null;   // e.g. "Grade 11" or "College"
  location: string | null;     // e.g. "New York, NY"
  interests: string[];
}

export interface ScoredOpportunity {
  opportunity: OpportunityView;
  score: number;
  reason: string;
}

const INTEREST_WEIGHT = 3;
const GRADE_WEIGHT = 2;
const LOCATION_WEIGHT = 1;

export function scoreOpportunity(profile: MatchProfile, o: OpportunityView): ScoredOpportunity {
  let score = 0;

  const overlap = o.targetInterests.filter((t) => profile.interests.includes(t));
  score += overlap.length * INTEREST_WEIGHT;

  const gradeOpen = o.targetGrades.length === 0;
  const gradeMatch = profile.gradeLabel != null && o.targetGrades.includes(profile.gradeLabel);
  if (gradeOpen || gradeMatch) score += GRADE_WEIGHT;

  const remote = o.location.toLowerCase().includes("remote");
  const sameLocation =
    profile.location != null && o.location.toLowerCase() === profile.location.toLowerCase();
  if (remote || sameLocation) score += LOCATION_WEIGHT;

  // Reason priority: interests > grade eligibility > location.
  let reason = "";
  if (overlap.length > 0) reason = "Matches your interests";
  else if (gradeMatch) reason = `${profile.gradeLabel} eligible`;
  else if (gradeOpen) reason = "Open to all grades";
  else if (remote) reason = "Remote-friendly";
  else if (sameLocation) reason = "Near you";

  return { opportunity: o, score, reason };
}

export function rankForUser(profile: MatchProfile, opportunities: OpportunityView[]): ScoredOpportunity[] {
  return opportunities
    .map((o) => scoreOpportunity(profile, o))
    .sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all 6 tests green.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts lib/matching.ts lib/matching.test.ts package.json package-lock.json
git commit -m "feat: add deterministic opportunity matching scorer with tests"
```

---

## Task 4: Extended onboarding step (GPA + interests + extracurriculars)

**Files:**
- Modify: `lib/validations.ts`
- Create: `app/api/user/onboarding/matching/route.ts`
- Create: `app/onboarding/matching/page.tsx`
- Modify: `app/onboarding/student-details/page.tsx` (redirect target)

- [ ] **Step 1: Add the validation schema**

In `lib/validations.ts`, add after `studentDetailsSchema`:

```typescript
export const matchingProfileSchema = z.object({
  gpaRange: z.enum(["BELOW_3_0", "R3_0_3_5", "R3_5_3_8", "R3_8_PLUS"]),
  interests: z.array(z.string().min(1).max(50)).min(1, "Pick at least one interest").max(5, "Pick up to 5 interests"),
  extracurriculars: z.array(z.string().min(1).max(80)).max(10).optional(),
});

export type MatchingProfileInput = z.infer<typeof matchingProfileSchema>;
```

- [ ] **Step 2: Add the API route**

Create `app/api/user/onboarding/matching/route.ts` (mirrors the existing student-details route exactly — `auth()` guard, Zod parse, `db.user.update`):

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { matchingProfileSchema } from "@/lib/validations";
import { GpaRange } from "@prisma/client";

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = matchingProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { gpaRange, interests, extracurriculars } = parsed.data;
  await db.user.update({
    where: { id: session.user.id },
    data: {
      gpaRange: gpaRange as GpaRange,
      interests,
      extracurriculars: extracurriculars ?? [],
    },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Add the onboarding page**

Create `app/onboarding/matching/page.tsx`. It collects GPA (toggle buttons), interests (click-to-select, max 5), and extracurriculars (comma list), then redirects to `/profile/edit` (the existing final destination). Match the inline-styled early-2000s theme used elsewhere:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const INTEREST_OPTIONS = ["Technology", "Science", "Business", "Arts", "Politics", "Medicine", "Law", "Environment"];
const GPA_OPTIONS: { value: string; label: string }[] = [
  { value: "BELOW_3_0", label: "Below 3.0" },
  { value: "R3_0_3_5", label: "3.0–3.5" },
  { value: "R3_5_3_8", label: "3.5–3.8" },
  { value: "R3_8_PLUS", label: "3.8+" },
];

export default function MatchingPage() {
  const router = useRouter();
  const [gpa, setGpa] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [extra, setExtra] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function toggleInterest(i: string) {
    setInterests((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : prev.length < 5 ? [...prev, i] : prev
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!gpa) return setError("Please select your GPA range.");
    if (interests.length === 0) return setError("Pick at least one interest.");
    setIsLoading(true);
    try {
      const res = await fetch("/api/user/onboarding/matching", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gpaRange: gpa,
          interests,
          extracurriculars: extra.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) return setError("Something went wrong. Please try again.");
      router.push("/profile/edit");
    } finally {
      setIsLoading(false);
    }
  }

  const chip = (active: boolean) => ({
    background: active ? "#3b5998" : "#e8edf5",
    color: active ? "#fff" : "#3b5998",
    border: active ? "1px solid #29487d" : "1px solid #c8d0e0",
    borderRadius: "2px", padding: "4px 10px", fontSize: "12px", cursor: "pointer",
  });

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", marginBottom: "4px" }}>
        Help us find your best matches
      </div>
      <div style={{ fontSize: "11px", color: "#666", marginBottom: "16px" }}>
        Takes 60 seconds. You can always update this later.
      </div>

      {error && (
        <div style={{ background: "#fff3f3", border: "1px solid #f5c6cb", color: "#c00", fontSize: "11px", padding: "6px 8px", borderRadius: "2px", marginBottom: "10px" }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ fontSize: "12px", fontWeight: "bold", color: "#333", marginBottom: "5px" }}>GPA Range</div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
          {GPA_OPTIONS.map((g) => (
            <span key={g.value} style={chip(gpa === g.value)} onClick={() => setGpa(g.value)}>{g.label}</span>
          ))}
        </div>

        <div style={{ fontSize: "12px", fontWeight: "bold", color: "#333", marginBottom: "5px" }}>
          Interests <span style={{ fontWeight: "normal", color: "#666" }}>(pick up to 5)</span>
        </div>
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginBottom: "14px" }}>
          {INTEREST_OPTIONS.map((i) => (
            <span key={i} style={chip(interests.includes(i))} onClick={() => toggleInterest(i)}>{i}</span>
          ))}
        </div>

        <div style={{ fontSize: "12px", fontWeight: "bold", color: "#333", marginBottom: "5px" }}>
          Extracurriculars <span style={{ fontWeight: "normal", color: "#666" }}>(optional, comma-separated)</span>
        </div>
        <input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="Robotics Club, Debate Team..."
          style={{ width: "100%", boxSizing: "border-box", border: "1px solid #bdc7d8", padding: "5px 7px", fontSize: "13px", borderRadius: "2px", marginBottom: "16px" }}
        />

        <button type="submit" disabled={isLoading} style={{ width: "100%", background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "6px", fontSize: "13px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer" }}>
          {isLoading ? "Saving..." : "Get my recommendations →"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Insert the step into the onboarding flow**

In `app/onboarding/student-details/page.tsx`, change the post-submit redirect from `router.push("/profile/edit")` to `router.push("/onboarding/matching")`.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: PASS. `/onboarding/matching` appears in the route list.

- [ ] **Step 6: Manually verify the flow**

Run: `npm run dev`, sign in, walk to the student-details step, submit, and confirm you land on `/onboarding/matching`. Select a GPA + 1–5 interests, submit, and confirm you land on `/profile/edit` with no console errors.

- [ ] **Step 7: Commit**

```bash
git add lib/validations.ts app/api/user/onboarding/matching app/onboarding/matching app/onboarding/student-details/page.tsx
git commit -m "feat: add matching-profile onboarding step (GPA, interests, extracurriculars)"
```

---

## Task 5: "For You" tab on the home page

**Files:**
- Modify: `app/(main)/page.tsx` (becomes a server component)
- Create: `app/(main)/home-client.tsx`

- [ ] **Step 1: Move the current home UI into a client component**

Create `app/(main)/home-client.tsx`. Paste the **current** body of `app/(main)/page.tsx` into it, then make these changes:
1. Change the component signature to accept props:
   ```typescript
   import type { OpportunityView } from "@/lib/opportunities";
   import type { ScoredOpportunity } from "@/lib/matching";
   export default function HomeClient({ all, forYou, signedIn, profileSummary }: {
     all: OpportunityView[];
     forYou: ScoredOpportunity[];
     signedIn: boolean;
     profileSummary: string | null;
   }) {
   ```
2. Import shared constants from `@/lib/listings` (`OPPORTUNITY_TYPES`, `TYPE_LABELS`, `OpportunityTypeLabel`), drop the `LISTINGS` import.
3. Add a `tab` state: `const [tab, setTab] = useState<"forYou" | "all">(signedIn ? "forYou" : "all");`
4. Render a tab bar above the listings:
   ```tsx
   <div style={{ display: "flex", borderBottom: "2px solid #c8d0e0", marginBottom: "10px" }}>
     {signedIn && (
       <div onClick={() => setTab("forYou")} style={{ padding: "5px 12px", fontSize: "12px", cursor: "pointer", fontWeight: tab === "forYou" ? "bold" : "normal", color: tab === "forYou" ? "#3b5998" : "#666", borderBottom: tab === "forYou" ? "2px solid #3b5998" : "2px solid transparent", marginBottom: "-2px" }}>⭐ For You</div>
     )}
     <div onClick={() => setTab("all")} style={{ padding: "5px 12px", fontSize: "12px", cursor: "pointer", fontWeight: tab === "all" ? "bold" : "normal", color: tab === "all" ? "#3b5998" : "#666", borderBottom: tab === "all" ? "2px solid #3b5998" : "2px solid transparent", marginBottom: "-2px" }}>All</div>
   </div>
   ```
5. In the "For You" tab, render `forYou` (the scored list). Reuse the existing card markup, mapping over `forYou.map(({ opportunity, reason }) => ...)`. For each card, after the type tag, add a green match badge when `reason` is non-empty:
   ```tsx
   {reason && (
     <span style={{ background: "#e8f5e9", color: "#2e7d32", borderRadius: "2px", padding: "1px 5px", fontSize: "10px" }}>✓ {reason}</span>
   )}
   ```
   Above the list, show the profile summary: `{profileSummary && <div style={{ fontSize: "10px", color: "#666", marginBottom: "6px" }}>Based on your profile: {profileSummary}</div>}`.
6. In the "All" tab, keep the existing checkbox-filter + search behavior, but operate on the `all` prop instead of `LISTINGS`. Card links continue to point at `/opportunities/${listing.id}`.

- [ ] **Step 2: Make the page a server component**

Replace `app/(main)/page.tsx` entirely with:

```typescript
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAllOpportunities } from "@/lib/opportunities";
import { rankForUser, type MatchProfile } from "@/lib/matching";
import HomeClient from "./home-client";

export default async function HomePage() {
  const session = await auth();
  const all = await getAllOpportunities();

  let forYou = all.map((o) => ({ opportunity: o, score: 0, reason: "" }));
  let signedIn = false;
  let profileSummary: string | null = null;

  if (session?.user?.id) {
    signedIn = true;
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { schoolLevel: true, graduationYear: true, city: true, interests: true, occupationType: true },
    });
    if (user) {
      const gradeLabel = gradeLabelFor(user);
      const profile: MatchProfile = {
        gradeLabel,
        location: user.city ?? null,
        interests: user.interests ?? [],
      };
      forYou = rankForUser(profile, all);
      const parts = [gradeLabel, user.city, (user.interests ?? []).slice(0, 3).join(", ")].filter(Boolean);
      profileSummary = parts.length ? parts.join(" · ") : null;
    }
  }

  return <HomeClient all={all} forYou={forYou} signedIn={signedIn} profileSummary={profileSummary} />;
}

// Maps stored education info to the grade label the scorer expects.
function gradeLabelFor(u: { schoolLevel: string | null; graduationYear: number | null; occupationType: string | null }): string | null {
  if (u.occupationType === "STUDENT_COLLEGE" || u.schoolLevel === "College") return "College";
  if (u.graduationYear != null) {
    const yearsLeft = u.graduationYear - new Date().getFullYear();
    const grade = 12 - yearsLeft;        // grad year - current year = years until grade 12
    if (grade >= 9 && grade <= 12) return `Grade ${grade}`;
  }
  if (u.schoolLevel === "High School") return "Grade 12";
  return null;
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS. `/` shows as `ƒ (Dynamic)`.

- [ ] **Step 4: Manually verify**

Run `npm run dev`. Logged out: home shows only the "All" tab with all 9 opportunities. Logged in (with a completed matching profile): the "⭐ For You" tab is default, shows the profile summary line, lists opportunities ranked by match with green "✓ ..." badges on the matched ones, and the "All" tab still filters by checkbox + search.

- [ ] **Step 5: Commit**

```bash
git add "app/(main)/page.tsx" "app/(main)/home-client.tsx"
git commit -m "feat: add For You matching tab to the home page"
```

---

## Self-Review Notes

- **Spec coverage:** Data model (all 6 tables) → Task 1. Opportunity table replaces `lib/listings.ts` → Task 2. Deterministic matching (grade + interest + location) → Task 3. Extended onboarding (GPA, interests, extracurriculars; reuses existing studentType/grade/location) → Task 4. "For You" default tab with "why it matched" badges + "All" one click away → Task 5. Optional profile fields (`careerGoals`) → column added in Task 1, surfaced in the existing `/profile/edit` later (not Phase 1 UI). Phases 2–3 (Follow/FeedEvent/AiDraft) → tables created empty in Task 1; behavior deferred to their own plans.
- **Type consistency:** `OpportunityView` (lib/opportunities.ts) is the single UI shape consumed by the scorer, browse, detail, and home. `MatchProfile`/`ScoredOpportunity` are defined in Task 3 and consumed unchanged in Task 5. Friendly-label ↔ enum mapping lives only in `lib/listings.ts`.
- **No placeholders:** every code step contains full implementations.
