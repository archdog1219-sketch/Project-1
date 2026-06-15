# Standout Features — Design Spec

**Date:** 2026-06-15
**Status:** Approved (design); pending implementation plan
**Platform:** (name) — student opportunity platform (Next.js 16 App Router, TypeScript, early-2000s Facebook visual theme)

## Goal

Differentiate from LinkedIn/Indeed, whose core weakness for students is that they assume prior experience. Build three phases that progressively make the platform feel built *for* students: smart matching, a social activity feed, and application guidance. Audience is high school **and** college students, weighted equally.

## Approach

Infrastructure-first. Design the data model up front to support all three phases, then build Phase 1 fully. The shared tables (profile, saved opportunities, follow graph) are used across phases, so getting the schema right early means Phases 2 and 3 are additive rather than requiring migrations. Phase 1 ships first.

## Data Model

Six tables. Each serves at least two phases; `SavedOpportunity` is the linchpin — it powers the Phase 3 tracker and emits Phase 2 feed events on status change.

### User / Profile (extend existing)
Existing: `id`, `email`, `name`, `occupation`.
New (Phase 1, collected at onboarding — "medium"):
- `gradeLevel` — enum/string (HS grade 9–12, or college year)
- `studentType` — `highschool` | `college`
- `location` — string (city, state)
- `gpaRange` — enum (`<3.0`, `3.0–3.5`, `3.5–3.8`, `3.8+`)
- `interests` — string[] (max 5, from a fixed tag set)
- `extracurriculars` — string[]

Optional (Phase 1 expansion, editable from profile after signup):
- `skills` — string[]
- `careerGoals` — string
- `bio` — string

### Opportunity (new — replaces hardcoded `lib/listings.ts`)
`id`, `title`, `org`, `type`, `location`, `description`, `tags[]`, `deadline?`, `applyUrl?`, plus matching fields:
- `targetGrades` — string[] (which grades/years are eligible)
- `targetInterests` — string[] (interest tags this maps to)
- `isPaid` — boolean

### SavedOpportunity (new)
`id`, `userId`, `opportunityId`, `status` (`saved` | `applying` | `applied`), `notes?`, `savedAt`.
- Powers the Phase 3 deadline tracker.
- A status change writes a `FeedEvent` (Phase 2).

### Follow (new — Phase 2)
`id`, `followerId`, `followingId`, `createdAt`. Simple follow graph.

### FeedEvent (new — Phase 2)
`id`, `actorId`, `type` (`saved` | `applied` | `accepted`), `opportunityId`, `createdAt`.
- Written when a user updates `SavedOpportunity` status.
- Feed query: `FeedEvent WHERE actorId IN (people I follow) ORDER BY createdAt DESC`.

### AiDraft (new — Phase 3)
`id`, `userId`, `opportunityId`, `content`, `generatedAt`. One generated cover-letter/essay draft per user+opportunity pair.

## Phase 1 — Smart Matching

**Extended onboarding step.** A new onboarding screen collects the "medium" profile fields: student type (toggle), grade/year (dropdown), location (text), GPA range (toggle buttons), interests (click-to-select tags, max 5). Copy: "Help us find your best matches — takes 60 seconds. You can always update this later." Extracurriculars and the optional fields are added later from the profile.

**"For You" tab on the home page.** Tabs across the top: ⭐ For You (default), All, Jobs, Internships, etc. "For You" filters/ranks opportunities by matching the user's profile against `targetGrades`, `targetInterests`, and `location`. Each matched card shows a green badge explaining *why* it matched ("✓ Matches your interests", "✓ Grade 11 eligible"). "All" remains one click away.

**Matching logic (Phase 1, simple & deterministic — no ML):** score each opportunity by overlap — grade eligibility (must match `targetGrades` or be open to all), interest overlap count, location proximity (same city/state or remote). Rank by score; show the dominant reason as the badge.

## Phase 2 — Activity Feed

**Feed page (new nav tab).** Chronological list of `FeedEvent`s from people the user follows: "Sarah M. applied to Software Engineering Intern at Google", "James L. was accepted to STEM Residential Program at MIT". Each row has an avatar (initials), the action text, and a relative timestamp.

**Follow button** on profile pages, with follower/following counts.

**"People Like You" rail** — suggests students with overlapping interests, so a new user's feed isn't empty on day one (solves the cold-start problem).

**Privacy:** per-event default — `saved` events are private; `applied`/`accepted` are shareable to followers with a quick opt-out. (Details finalized at implementation.)

## Phase 3 — Deadline Tracker + AI Application Assist

**My Tracker (new nav tab).** The user's saved opportunities grouped into three status lanes: 📌 Saved → ✍️ Applying → ✅ Applied. Each card shows the org and deadline; anything due soon gets a red "⏰ Due in N days" warning. A status dropdown on each card moves it between lanes — and that single action also writes the Phase 2 `FeedEvent` and updates deadline reminders.

**AI Application Assist** on the opportunity detail page. A "✨ Generate draft" button produces a cover-letter draft tailored to the student's profile (grade, interests, extracurriculars) and the specific role. The draft is editable, with Copy / Regenerate / Edit actions, and a disclaimer to review and personalize before sending. Stored as an `AiDraft`.

**AI integration details:**
- Provider: Claude via the official `@anthropic-ai/sdk` (TypeScript).
- Model: `claude-haiku-4-5` — fast and cost-effective for short-form generation. (Do not append a date suffix.)
- A single `messages.create` call. `max_tokens` ~1024. No thinking, no `effort` (Haiku 4.5 does not support `effort`).
- Called from a Next.js server route (API key server-side only, never exposed to the client). Rate-limited per user (reuse the existing Upstash limiter pattern).

## Out of Scope (YAGNI)

- Reviews/ratings (explicitly dropped — feed only for the social layer).
- ML-based matching (Phase 1 is deterministic scoring).
- Real-time feed updates / websockets (polling/refresh is fine).
- Notifications/email digests for the feed or deadlines (later, if validated).

## Build Order

1. Data model migration (all six tables) + replace `lib/listings.ts` reads with DB-backed `Opportunity`.
2. Phase 1: extended onboarding step + "For You" tab + matching logic.
3. Phase 2: Follow model, FeedEvent emission on status change, Feed page, "People Like You" rail.
4. Phase 3: Tracker page (status lanes) + AI Application Assist (server route + UI).

Each phase ships independently. Phases 2 and 3 are additive — no rework of Phase 1.
