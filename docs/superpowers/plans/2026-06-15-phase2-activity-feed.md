# Phase 2 (Activity Feed) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let students follow each other and see a chronological feed of what the people they follow are applying to / getting accepted to, seeded by a minimal save/apply action on opportunities and a "people like you" discovery rail.

**Architecture:** The `Follow`, `SavedOpportunity`, and `FeedEvent` tables already exist (created empty in Phase 1). Add: (1) pure helpers for feed-event rules and suggestion ranking (unit-tested with Vitest); (2) DB accessors in `lib/social.ts`; (3) two API routes (save-status, follow/unfollow); (4) a minimal Save/Applied control on the opportunity detail page that writes a `SavedOpportunity` and emits a `FeedEvent` on apply; (5) a Follow button on profile pages; (6) a `/feed` page showing followed-user events + a suggestions rail; (7) a "Feed" nav link.

**Privacy default:** `SAVED` is private (no feed event). `APPLIED` and `ACCEPTED` emit feed events. This matches the spec's "saved events are private; applied/accepted are shareable" without building a per-event opt-out UI (deferred).

**Tech Stack:** Next.js 16 (App Router), Prisma 7 (+ `@prisma/adapter-neon`), NextAuth v5 (`auth()`), Zod 4, Vitest, TypeScript. Two visual themes coexist: opportunity/feed pages use the early-2000s inline style (`#3b5998`); profile pages use the older indigo/Tailwind components — the Follow button matches the profile page it lives on.

---

## File Structure

- `lib/feed-logic.ts` — NEW. Pure functions: `feedEventTypeForStatus`, `shouldEmitFeedEvent`, `rankSuggestions`. No DB.
- `lib/feed-logic.test.ts` — NEW. Vitest unit tests.
- `lib/social.ts` — NEW. DB accessors: `setSaveStatus`, `getSaveStatus`, `followUser`, `unfollowUser`, `isFollowing`, `getFollowCounts`, `getFeed`, `getFollowSuggestions`.
- `lib/validations.ts` — MODIFY. Add `saveStatusSchema` and `followSchema`.
- `app/api/opportunities/[id]/save/route.ts` — NEW. POST: set the signed-in user's save status for an opportunity (emits feed event on apply).
- `app/api/follow/route.ts` — NEW. POST follow / DELETE unfollow.
- `app/(main)/opportunities/[id]/opportunity-actions.tsx` — NEW. Client Save/Applied control.
- `app/(main)/opportunities/[id]/page.tsx` — MODIFY. Render `OpportunityActions` for signed-in users (pass current save status).
- `components/profile/follow-button.tsx` — NEW. Client Follow/Unfollow button.
- `app/profile/[id]/page.tsx` — MODIFY. Render `FollowButton` + follow counts when viewing someone else's profile.
- `app/(main)/feed/page.tsx` — NEW. Server component: auth-gated feed + suggestions rail.
- `app/(main)/feed/feed-client.tsx` — NEW. Client suggestions rail (follow buttons that update without full reload). Feed list itself is server-rendered.
- `app/(main)/layout.tsx` — MODIFY. Add a "Feed" nav link.

---

## Task 1: Pure feed-logic helpers (TDD)

**Files:**
- Create: `lib/feed-logic.ts`
- Test: `lib/feed-logic.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/feed-logic.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { feedEventTypeForStatus, shouldEmitFeedEvent, rankSuggestions } from "./feed-logic";

describe("feedEventTypeForStatus", () => {
  it("maps APPLIED and ACCEPTED to feed event types, SAVED to null", () => {
    expect(feedEventTypeForStatus("APPLIED")).toBe("APPLIED");
    expect(feedEventTypeForStatus("ACCEPTED")).toBe("ACCEPTED");
    expect(feedEventTypeForStatus("APPLYING")).toBeNull();
    expect(feedEventTypeForStatus("SAVED")).toBeNull();
  });
});

describe("shouldEmitFeedEvent", () => {
  it("emits when transitioning INTO a shareable status from a different one", () => {
    expect(shouldEmitFeedEvent(null, "APPLIED")).toBe(true);
    expect(shouldEmitFeedEvent("SAVED", "APPLIED")).toBe(true);
    expect(shouldEmitFeedEvent("APPLIED", "ACCEPTED")).toBe(true);
  });
  it("does not emit for private SAVED or for no-op transitions", () => {
    expect(shouldEmitFeedEvent(null, "SAVED")).toBe(false);
    expect(shouldEmitFeedEvent("SAVED", "SAVED")).toBe(false);
    expect(shouldEmitFeedEvent("APPLIED", "APPLIED")).toBe(false);
  });
});

describe("rankSuggestions", () => {
  const me = { id: "me", interests: ["Technology", "Science"] };
  it("ranks candidates by shared-interest count, excludes self and already-followed", () => {
    const ranked = rankSuggestions(me, [
      { id: "a", name: "A", interests: ["Technology", "Science"] },
      { id: "b", name: "B", interests: ["Law"] },
      { id: "me", name: "Me", interests: ["Technology"] },
      { id: "c", name: "C", interests: ["Technology"] },
    ], new Set(["b"]));
    expect(ranked.map((u) => u.id)).toEqual(["a", "c"]);
  });
  it("drops candidates with zero shared interests", () => {
    const ranked = rankSuggestions(me, [{ id: "x", name: "X", interests: ["Art"] }], new Set());
    expect(ranked).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it FAILS**

Run: `npm test`
Expected: FAIL — cannot find module `./feed-logic`.

- [ ] **Step 3: Implement**

Create `lib/feed-logic.ts`:

```typescript
export type SaveStatus = "SAVED" | "APPLYING" | "APPLIED" | "ACCEPTED";
export type FeedEventType = "SAVED" | "APPLIED" | "ACCEPTED";

// Which save statuses are publicly shareable as feed events. SAVED/APPLYING are private.
export function feedEventTypeForStatus(status: SaveStatus): FeedEventType | null {
  if (status === "APPLIED") return "APPLIED";
  if (status === "ACCEPTED") return "ACCEPTED";
  return null;
}

// Emit a feed event only when moving INTO a shareable status from a different status.
export function shouldEmitFeedEvent(prev: SaveStatus | null, next: SaveStatus): boolean {
  if (prev === next) return false;
  return feedEventTypeForStatus(next) !== null;
}

export interface SuggestionCandidate {
  id: string;
  name: string | null;
  interests: string[];
}

// Rank candidate users by number of shared interests with `me`, descending.
// Excludes self, already-followed users, and anyone with zero overlap.
export function rankSuggestions(
  me: { id: string; interests: string[] },
  candidates: SuggestionCandidate[],
  alreadyFollowing: Set<string>
): (SuggestionCandidate & { shared: number })[] {
  const mine = new Set(me.interests.map((i) => i.toLowerCase()));
  return candidates
    .filter((c) => c.id !== me.id && !alreadyFollowing.has(c.id))
    .map((c) => ({
      ...c,
      shared: c.interests.filter((i) => mine.has(i.toLowerCase())).length,
    }))
    .filter((c) => c.shared > 0)
    .sort((a, b) => b.shared - a.shared);
}
```

- [ ] **Step 4: Run the test to verify it PASSES**

Run: `npm test`
Expected: PASS (existing matching tests + these new ones all green).

- [ ] **Step 5: Commit**

```bash
git add lib/feed-logic.ts lib/feed-logic.test.ts
git commit -m "feat: add pure feed-event and suggestion-ranking helpers with tests"
```

---

## Task 2: Validation schemas

**Files:**
- Modify: `lib/validations.ts`

- [ ] **Step 1: Add schemas**

In `lib/validations.ts`, add at the end (before the final `export type` block if present, otherwise at the end):

```typescript
export const saveStatusSchema = z.object({
  status: z.enum(["SAVED", "APPLYING", "APPLIED", "ACCEPTED"]),
});

export const followSchema = z.object({
  targetId: z.string().min(1, "targetId is required"),
});

export type SaveStatusInput = z.infer<typeof saveStatusSchema>;
export type FollowInput = z.infer<typeof followSchema>;
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/validations.ts
git commit -m "feat: add save-status and follow validation schemas"
```

---

## Task 3: Social DB accessors

**Files:**
- Create: `lib/social.ts`

- [ ] **Step 1: Implement the accessors**

Create `lib/social.ts`:

```typescript
import { db } from "@/lib/db";
import { FeedEventType, SaveStatus } from "@prisma/client";
import { feedEventTypeForStatus, shouldEmitFeedEvent, rankSuggestions } from "@/lib/feed-logic";

// --- Saving / applying ---

export async function getSaveStatus(userId: string, opportunityId: string): Promise<SaveStatus | null> {
  const row = await db.savedOpportunity.findUnique({
    where: { userId_opportunityId: { userId, opportunityId } },
    select: { status: true },
  });
  return row?.status ?? null;
}

// Upserts the user's save status for an opportunity, emitting a FeedEvent when
// the transition is into a shareable status (APPLIED/ACCEPTED). Returns the new status.
export async function setSaveStatus(
  userId: string,
  opportunityId: string,
  status: SaveStatus
): Promise<SaveStatus> {
  const prev = await getSaveStatus(userId, opportunityId);

  await db.savedOpportunity.upsert({
    where: { userId_opportunityId: { userId, opportunityId } },
    create: { userId, opportunityId, status },
    update: { status },
  });

  if (shouldEmitFeedEvent(prev, status)) {
    const type = feedEventTypeForStatus(status);
    if (type) {
      await db.feedEvent.create({
        data: { actorId: userId, opportunityId, type: type as FeedEventType },
      });
    }
  }

  return status;
}

// --- Following ---

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const row = await db.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
    select: { id: true },
  });
  return row !== null;
}

export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) return;
  await db.follow.upsert({
    where: { followerId_followingId: { followerId, followingId } },
    create: { followerId, followingId },
    update: {},
  });
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  await db.follow.deleteMany({ where: { followerId, followingId } });
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    db.follow.count({ where: { followingId: userId } }),
    db.follow.count({ where: { followerId: userId } }),
  ]);
  return { followers, following };
}

// --- Feed ---

export interface FeedItem {
  id: string;
  type: FeedEventType;
  createdAt: Date;
  actorId: string;
  actorName: string | null;
  opportunityId: string;
  opportunityTitle: string;
  opportunityOrg: string;
}

export async function getFeed(userId: string, limit = 50): Promise<FeedItem[]> {
  const following = await db.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  const actorIds = following.map((f) => f.followingId);
  if (actorIds.length === 0) return [];

  const events = await db.feedEvent.findMany({
    where: { actorId: { in: actorIds } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: { select: { id: true, name: true } },
      opportunity: { select: { id: true, title: true, org: true } },
    },
  });

  return events.map((e) => ({
    id: e.id,
    type: e.type,
    createdAt: e.createdAt,
    actorId: e.actor.id,
    actorName: e.actor.name,
    opportunityId: e.opportunity.id,
    opportunityTitle: e.opportunity.title,
    opportunityOrg: e.opportunity.org,
  }));
}

// --- Suggestions ("people like you") ---

export interface Suggestion {
  id: string;
  name: string | null;
  shared: number;
}

export async function getFollowSuggestions(userId: string, limit = 5): Promise<Suggestion[]> {
  const me = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, interests: true },
  });
  if (!me || me.interests.length === 0) return [];

  // Candidate pool: users sharing at least one interest (DB-level prefilter), capped.
  const candidates = await db.user.findMany({
    where: {
      id: { not: userId },
      interests: { hasSome: me.interests },
    },
    select: { id: true, name: true, interests: true },
    take: 50,
  });

  const following = await db.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  const alreadyFollowing = new Set(following.map((f) => f.followingId));

  return rankSuggestions({ id: me.id, interests: me.interests }, candidates, alreadyFollowing)
    .slice(0, limit)
    .map((c) => ({ id: c.id, name: c.name, shared: c.shared }));
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS. (`userId_opportunityId` and `followerId_followingId` are the compound-unique selectors Prisma generates from the `@@unique` constraints in the schema.)

- [ ] **Step 3: Commit**

```bash
git add lib/social.ts
git commit -m "feat: add social DB accessors (save status, follow, feed, suggestions)"
```

---

## Task 4: Save/apply API route

**Files:**
- Create: `app/api/opportunities/[id]/save/route.ts`

- [ ] **Step 1: Implement**

Create `app/api/opportunities/[id]/save/route.ts` (mirrors the auth-guard + Zod pattern from `app/api/user/onboarding/matching/route.ts`):

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saveStatusSchema } from "@/lib/validations";
import { setSaveStatus } from "@/lib/social";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = saveStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const status = await setSaveStatus(session.user.id, id, parsed.data.status);
  return NextResponse.json({ status });
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: PASS; `/api/opportunities/[id]/save` appears in the route list.

- [ ] **Step 3: Commit**

```bash
git add "app/api/opportunities/[id]/save"
git commit -m "feat: add save/apply status API route"
```

---

## Task 5: Follow API route

**Files:**
- Create: `app/api/follow/route.ts`

- [ ] **Step 1: Implement**

Create `app/api/follow/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { followSchema } from "@/lib/validations";
import { followUser, unfollowUser } from "@/lib/social";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const parsed = followSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  if (parsed.data.targetId === session.user.id) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }
  await followUser(session.user.id, parsed.data.targetId);
  return NextResponse.json({ following: true });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const parsed = followSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  await unfollowUser(session.user.id, parsed.data.targetId);
  return NextResponse.json({ following: false });
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: PASS; `/api/follow` appears in the route list.

- [ ] **Step 3: Commit**

```bash
git add app/api/follow
git commit -m "feat: add follow/unfollow API route"
```

---

## Task 6: Save/Applied control on the opportunity detail page

**Files:**
- Create: `app/(main)/opportunities/[id]/opportunity-actions.tsx`
- Modify: `app/(main)/opportunities/[id]/page.tsx`

- [ ] **Step 1: Create the client control**

Create `app/(main)/opportunities/[id]/opportunity-actions.tsx`:

```typescript
"use client";

import { useState } from "react";

type Status = "SAVED" | "APPLYING" | "APPLIED" | "ACCEPTED" | null;

export default function OpportunityActions({
  opportunityId,
  initialStatus,
}: {
  opportunityId: string;
  initialStatus: Status;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [busy, setBusy] = useState(false);

  async function set(next: "SAVED" | "APPLIED") {
    setBusy(true);
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
      }
    } finally {
      setBusy(false);
    }
  }

  const btn = (bg: string, border: string, color: string) => ({
    display: "block", width: "100%", boxSizing: "border-box" as const,
    background: bg, color, border: `1px solid ${border}`,
    padding: "6px 0", fontSize: "12px", fontWeight: "bold" as const,
    borderRadius: "2px", cursor: busy ? "default" : "pointer", marginBottom: "6px",
  });

  const saved = status === "SAVED" || status === "APPLYING";
  const applied = status === "APPLIED" || status === "ACCEPTED";

  return (
    <div style={{ marginBottom: "8px" }}>
      <button disabled={busy} style={btn(saved ? "#e8edf5" : "#fff", "#c8d0e0", "#3b5998")} onClick={() => set("SAVED")}>
        {saved ? "✓ Saved" : "📌 Save"}
      </button>
      <button disabled={busy} style={btn(applied ? "#e8f5e9" : "#3b5998", applied ? "#2e7d32" : "#29487d", applied ? "#2e7d32" : "#fff")} onClick={() => set("APPLIED")}>
        {applied ? "✓ Applied" : "Mark as applied"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the detail page**

In `app/(main)/opportunities/[id]/page.tsx`:
1. Add imports at the top:
   ```typescript
   import { auth } from "@/lib/auth";
   import { getSaveStatus } from "@/lib/social";
   import OpportunityActions from "./opportunity-actions";
   ```
2. After `const listing = await getOpportunityById(id); if (!listing) notFound();`, add:
   ```typescript
   const session = await auth();
   const saveStatus = session?.user?.id ? await getSaveStatus(session.user.id, listing.id) : null;
   ```
3. In the sidebar, immediately BEFORE the existing `Apply Now` anchor (`<a href={listing.applyUrl ...}>`), render the control for signed-in users:
   ```tsx
   {session?.user?.id && <OpportunityActions opportunityId={listing.id} initialStatus={saveStatus} />}
   ```
   Leave the existing "Apply Now" link and the "Sign up to save" line as they are (the sign-up line still helps logged-out visitors).

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/(main)/opportunities/[id]"
git commit -m "feat: add Save/Applied control to opportunity detail page"
```

---

## Task 7: Follow button on profile pages

**Files:**
- Create: `components/profile/follow-button.tsx`
- Modify: `app/profile/[id]/page.tsx`

- [ ] **Step 1: Create the Follow button (matches the profile page's Tailwind/indigo theme)**

Create `components/profile/follow-button.tsx`:

```typescript
"use client";

import { useState } from "react";

export default function FollowButton({
  targetId,
  initialFollowing,
}: {
  targetId: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/follow", {
        method: following ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId }),
      });
      if (res.ok) {
        const data = await res.json();
        setFollowing(data.following);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
        following
          ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
          : "bg-indigo-600 text-white hover:bg-indigo-700"
      } disabled:opacity-50`}
    >
      {following ? "Following" : "+ Follow"}
    </button>
  );
}
```

- [ ] **Step 2: Wire into the profile page**

In `app/profile/[id]/page.tsx`:
1. Add imports:
   ```typescript
   import FollowButton from "@/components/profile/follow-button";
   import { isFollowing, getFollowCounts } from "@/lib/social";
   ```
2. After `const isOwnProfile = session?.user?.id === id;`, add:
   ```typescript
   const counts = await getFollowCounts(id);
   const viewerFollows =
     session?.user?.id && !isOwnProfile ? await isFollowing(session.user.id, id) : false;
   ```
3. Inside the left sidebar column (the `<div className="md:w-64 shrink-0">`), directly AFTER the `<ProfileSidebar ... />` element, add a follow block:
   ```tsx
   <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-4">
     {session?.user?.id && !isOwnProfile && (
       <FollowButton targetId={id} initialFollowing={viewerFollows} />
     )}
     <p className="text-xs text-gray-500 mt-3 text-center">
       <span className="font-semibold text-gray-700">{counts.followers}</span> followers
       {" · "}
       <span className="font-semibold text-gray-700">{counts.following}</span> following
     </p>
   </div>
   ```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/profile/follow-button.tsx "app/profile/[id]/page.tsx"
git commit -m "feat: add Follow button and follow counts to profile pages"
```

---

## Task 8: Feed page + suggestions rail

**Files:**
- Create: `app/(main)/feed/feed-client.tsx`
- Create: `app/(main)/feed/page.tsx`

- [ ] **Step 1: Create the suggestions-rail client component**

Create `app/(main)/feed/feed-client.tsx` (interactive follow buttons in the rail; on follow, the row disappears):

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";

export interface SuggestionView {
  id: string;
  name: string | null;
  shared: number;
}

export default function SuggestionsRail({ initial }: { initial: SuggestionView[] }) {
  const [people, setPeople] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function follow(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: id }),
      });
      if (res.ok) setPeople((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setBusy(null);
    }
  }

  if (people.length === 0) {
    return <div style={{ fontSize: "11px", color: "#999" }}>No suggestions right now.</div>;
  }

  return (
    <div>
      {people.map((p) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 0", borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#3b5998", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold", flexShrink: 0 }}>
            {(p.name ?? "?").slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0, fontSize: "11px" }}>
            <Link href={`/profile/${p.id}`} style={{ color: "#3b5998", fontWeight: "bold", textDecoration: "none" }}>{p.name ?? "Student"}</Link>
            <div style={{ color: "#999", fontSize: "9px" }}>{p.shared} shared interest{p.shared === 1 ? "" : "s"}</div>
          </div>
          <button onClick={() => follow(p.id)} disabled={busy === p.id} style={{ background: "#e8edf5", color: "#3b5998", border: "1px solid #c8d0e0", padding: "2px 8px", fontSize: "10px", borderRadius: "2px", cursor: "pointer" }}>
            + Follow
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create the feed page (server, auth-gated)**

Create `app/(main)/feed/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getFeed, getFollowSuggestions } from "@/lib/social";
import SuggestionsRail from "./feed-client";

export const dynamic = "force-dynamic";

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const VERB: Record<string, string> = {
  SAVED: "saved",
  APPLIED: "applied to",
  ACCEPTED: "was accepted to",
};

export default async function FeedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/feed");

  const [feed, suggestions] = await Promise.all([
    getFeed(session.user.id),
    getFollowSuggestions(session.user.id),
  ]);

  const s = {
    panel: { background: "#e8edf5", border: "1px solid #c8d0e0", borderRadius: "3px", overflow: "hidden" as const },
    panelHead: { background: "#3b5998", color: "#fff", padding: "6px 12px", fontSize: "11px", fontWeight: "bold" as const },
  };

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif", maxWidth: "960px", margin: "0 auto", padding: "12px 16px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
      {/* Feed */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: "bold", color: "#3b5998", marginBottom: "8px" }}>Recent Activity</div>
        {feed.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#666", border: "1px solid #c8d0e0", borderRadius: "3px", background: "#fff", padding: "16px" }}>
            Your feed is empty. Follow some students (see suggestions →) and their activity will show up here.
          </div>
        ) : (
          feed.map((e) => (
            <div key={e.id} style={{ display: "flex", gap: "8px", padding: "8px 10px", border: "1px solid #c8d0e0", borderRadius: "3px", background: "#fff", marginBottom: "5px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#3b5998", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "bold", flexShrink: 0 }}>
                {(e.actorName ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <div style={{ fontSize: "12px", lineHeight: 1.5 }}>
                <Link href={`/profile/${e.actorId}`} style={{ color: "#3b5998", fontWeight: "bold", textDecoration: "none" }}>{e.actorName ?? "A student"}</Link>
                {" "}{VERB[e.type] ?? "updated"}{" "}
                <Link href={`/opportunities/${e.opportunityId}`} style={{ color: "#3b5998", fontWeight: "bold", textDecoration: "none" }}>{e.opportunityTitle}</Link>
                {" "}at {e.opportunityOrg}
                <div style={{ color: "#999", fontSize: "10px" }}>{timeAgo(e.createdAt)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Suggestions rail */}
      <aside style={{ width: "220px", flexShrink: 0 }}>
        <div style={s.panel}>
          <div style={s.panelHead}>Students with similar interests</div>
          <div style={{ padding: "8px 12px", background: "#fff" }}>
            <SuggestionsRail initial={suggestions} />
          </div>
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: PASS; `/feed` appears as dynamic `ƒ`.

- [ ] **Step 4: Commit**

```bash
git add "app/(main)/feed"
git commit -m "feat: add activity feed page with suggestions rail"
```

---

## Task 9: Add the Feed nav link

**Files:**
- Modify: `app/(main)/layout.tsx`

- [ ] **Step 1: Add the link**

In `app/(main)/layout.tsx`, in the nav-links row, add a Feed link after Home. The current row is:
```tsx
<Link href="/" className="nav-link">Home</Link>
<Link href="/sign-up" className="nav-link">Sign Up</Link>
<Link href="/browse" className="nav-link">Browse</Link>
<Link href="/about" className="nav-link">About</Link>
```
Change it to:
```tsx
<Link href="/" className="nav-link">Home</Link>
<Link href="/feed" className="nav-link">Feed</Link>
<Link href="/browse" className="nav-link">Browse</Link>
<Link href="/about" className="nav-link">About</Link>
```
(The "Sign Up" nav link is redundant with the Sign Up button in the top row, so replacing it with Feed is intentional. The `/feed` page itself redirects logged-out users to sign-in.)

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(main)/layout.tsx"
git commit -m "feat: add Feed link to main nav"
```

---

## Self-Review Notes

- **Spec coverage:** Activity feed (chronological events from followed users) → Tasks 3 (`getFeed`) + 8. Follow button + follower/following counts → Tasks 5, 7. "People Like You" rail (overlapping interests, excludes self + already-followed) → Tasks 1 (`rankSuggestions`), 3 (`getFollowSuggestions`), 8. Save/apply that emits feed events → Tasks 1 (`shouldEmitFeedEvent`), 3 (`setSaveStatus`), 4, 6. Privacy default (saved private, applied/accepted shared) → encoded in `feedEventTypeForStatus`/`shouldEmitFeedEvent` (Task 1). Feed nav entry → Task 9.
- **Deferred (out of Phase 2 scope, consistent with the plan):** full tracker dashboard with status lanes + deadline warnings (Phase 3); ACCEPTED has no UI trigger yet (the feed renders it if present, but only Save/Applied are exposed — accepted-marking arrives with the Phase 3 tracker); per-event privacy opt-out toggle.
- **Type consistency:** `SaveStatus`/`FeedEventType` string unions in `lib/feed-logic.ts` mirror the Prisma enums; `lib/social.ts` imports the Prisma enum types and casts at the DB boundary. `FeedItem`/`Suggestion`/`SuggestionView` shapes are defined once and consumed by the feed page + rail. Compound-unique selectors `userId_opportunityId` and `followerId_followingId` come from the Phase 1 schema's `@@unique` constraints.
- **No placeholders:** every code step is complete.
