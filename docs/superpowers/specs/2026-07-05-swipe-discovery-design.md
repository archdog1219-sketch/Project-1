# Swipe Discovery — Design Spec

**Date:** 2026-07-05
**Status:** Approved verbally (user requested the feature and authorized building it while away); judgment calls below were made autonomously and are flagged for review.
**Platform:** (name) — student opportunity platform (Next.js 16 App Router, Prisma 7, NextAuth v5, current early-2000s theme).

## Goal

A one-at-a-time, swipeable opportunity discovery experience ("Discover"). The app deals recommended opportunities to the signed-in user as a card deck. **Swipe left = save the opportunity; swipe right = skip it** (the user's explicit spec — note this is inverted from dating-app convention; it is a one-constant flip if they later want it changed). Recommendations come from a profile-based algorithm (grade, location, interests).

## The Recommendation Algorithm

The user asked for "an algorithm that recommends based on the user's profile (grade, location, interests)". **Phase 1 already built exactly this** — the deterministic scorer in `lib/matching.ts` (`scoreOpportunity`/`rankForUser`: interest overlap ×3, grade eligibility ×2, location ×1, with human-readable match reasons). Building a parallel algorithm would duplicate it, so Discover **extends** the existing engine with the parts that are genuinely new:

1. **Exclusion memory** — opportunities the user has already acted on (saved/applied at any status, or skipped in Discover) never reappear in the deck.
2. **Deck composition** — a pure `buildDeck(profile, opportunities, excludedIds, limit)` filters out acted-on items, ranks the rest with `rankForUser`, and caps the deck (20 per load).
3. **Serving** — the `/discover` page deals the deck one card at a time, highest match first, each card showing *why* it matched (reusing the existing reason strings: "Matches your interests", "Grade 11 eligible", etc.).

Users with an empty matching profile still get a deck (all score 0, unranked) plus a hint linking to `/onboarding/matching` to improve recommendations.

## Data Model

One new table (skips must persist or the deck would re-deal rejected cards forever):

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

**Saves need no new storage** — a left-swipe calls the existing `setSaveStatus(userId, opportunityId, "SAVED")`, so swipe-saves:
- land in the **Tracker**'s Saved lane automatically,
- stay **private** (SAVED emits no feed event, per the Phase-2 privacy default),
- are idempotent with saves made from the detail page.

Skips are **permanent** in v1 (no resurfacing window — YAGNI; a `createdAt` cutoff can add that later).

## API

`POST /api/opportunities/[id]/swipe` — body `{ direction: "save" | "skip" }` (new `swipeSchema` in `lib/validations.ts`).
Gate chain: auth (401) → dedicated swipe rate limit (429) → Zod (400) → opportunity exists (404) → `save` → `setSaveStatus(...)`, `skip` → idempotent `OpportunitySkip` upsert → `{ result: direction }`.

**Dedicated rate limiter:** `getSwipeRateLimit()` at **120/min per user** — swiping is a legitimately high-frequency action; the shared 40/min write limiter would throttle a fast swiper mid-deck. 120/min still caps abuse.

## UI — `/discover`

- Server page (auth-gated, `force-dynamic`): loads the user's profile + deck via a `getSwipeDeck(userId)` accessor, renders a client `SwipeDeck`.
- **Card**: title, org · location, type chip, match-reason badge (green, same style as home), deadline if present, a clamped description preview, and a "View full details →" link to `/opportunities/[id]`.
- **Gestures**: pointer-event drag (works for touch + mouse). Drag left past the threshold → SAVE stamp shows, card flies off, saved. Drag right → SKIP stamp, skipped. Below threshold → card springs back.
- **Fallbacks**: explicit "💾 Save" / "Skip ✕" buttons and keyboard arrows (← save, → skip) for accessibility.
- **Optimistic**: card advances immediately; if the API call fails, an inline error shows and the card is re-dealt.
- Progress indicator ("3 of 20"), an empty/finished state ("You're all caught up — check back for new opportunities"), and the profile-hint line for users without interests.
- **Styled in the current early-2000s theme** (#3b5998, Arial). The Ivory & Brass redesign is approved-but-paused; when it lands it will restyle this page along with everything else — building Discover in the new style now would make it inconsistent with the rest of the live app.
- Nav gains a **"Discover"** link (between Home and Feed).

## Code Placement

- `lib/matching.ts` — gains the shared `gradeLabelFor()` (currently duplicated in the home page and the AI-draft route; Discover would be the third copy, so it gets extracted with a `currentYear` parameter for testability, and both existing callers switch to the import).
- `lib/discover-logic.ts` — pure `buildDeck()` (unit-tested).
- `lib/discover.ts` — DB accessors `getSwipeDeck(userId, limit=20)` and `recordSkip(userId, opportunityId)`.
- `app/api/opportunities/[id]/swipe/route.ts` — the swipe endpoint.
- `app/(main)/discover/page.tsx` + `app/(main)/discover/swipe-deck.tsx` — page + client deck.

## Out of Scope (YAGNI)

- Undo-last-swipe; skip resurfacing/expiry; swipe analytics; ML/embedding-based ranking; employer-side visibility into swipe stats; mobile-app-style haptics.

## Judgment Calls Made Without You (flag if wrong)

1. **Left = save, right = skip** — built exactly as you specified, though it inverts the Tinder convention most users know. Flipping is a one-line change.
2. **Reused the Phase-1 scorer** as the ranking core instead of writing a second algorithm — same inputs you listed (grade, location, interests), already tested; the new work is exclusion memory + deck serving.
3. **Skips are permanent** (v1) and stored in a new table rather than polluting `SaveStatus`.
4. **Current theme, not Ivory & Brass** — redesign is paused; consistency wins until it ships.
5. **120/min swipe rate limit** (dedicated) so fast swiping isn't throttled.
