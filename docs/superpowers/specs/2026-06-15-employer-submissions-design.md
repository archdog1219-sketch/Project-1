# Employer Opportunity Submissions — Design Spec

**Date:** 2026-06-15
**Status:** Approved (design); pending implementation plan
**Platform:** (name) — student opportunity platform (Next.js 16 App Router, Prisma 7, NextAuth v5, early-2000s blue theme)

## Goal

Replace the demo-only opportunity catalog with real, employer-submitted opportunities. Employers post their own listings (no human approval queue); an automated **rule-based moderation gate** screens every submission at write time and rejects bad ones with a clear reason. Employers fully manage their own postings (create / edit / delete).

## Approach

Open employer submission gated to `EMPLOYER`-type accounts, with a deterministic (no-AI, no external dependency) moderation gate that runs **before** any database write. Because the gate runs pre-save, there is no quarantine/approval state — a rejected submission is simply never created. Submitted listings flow into the existing browse / "For You" / feed / detail surfaces with no changes, since those already read all opportunities from the database.

## Data Model

Extend the existing `Opportunity` model (no other table changes):

- `ownerId String?` — nullable FK to `User`. Employer-submitted listings have an owner; the 9 seed listings stay ownerless (visible as extras, not editable by any employer).
- Relation: `owner User? @relation("postedOpportunities", fields: [ownerId], references: [id], onDelete: Cascade)`.
- On `User`: reverse relation `postedOpportunities Opportunity[] @relation("postedOpportunities")`.
- `@@index([ownerId])` for the "my postings" query.

Migration is additive (nullable column) — safe for existing rows; applied via `prisma db push`.

## Moderation Gate (pure, rule-based, unit-tested)

A pure function in `lib/moderation.ts`:

```
validateSubmission(input: SubmissionInput): { ok: true } | { ok: false, reason: string }
```

`SubmissionInput` = the user-supplied fields (title, org, type, location, description, applyUrl?, deadline?, isPaid, targetGrades, targetInterests). The function is deterministic and has no I/O (duplicate + rate-limit checks live in the route, not here — see below). Rules, in order, first failure wins:

1. **Required + length sanity:** title 3–120 chars; org 2–120; location 2–120; description 30–4000 chars. `type` ∈ the four `OpportunityType` enum values. Empty/whitespace-only required fields fail.
2. **No contact info in free text:** reject if the **title or description** contains a URL, email address, or phone number. (The structured `applyUrl` field is the correct place for a link; contact info pasted into the body is the top scam vector.) `applyUrl` itself, when present, must be a valid `http(s)` URL.
3. **Scam / banned-phrase blocklist:** reject if title/description matches a curated list (e.g. "wire transfer", "processing fee", "pay to apply", "registration fee", "gift card", "western union", "guaranteed income", "crypto" payment phrasing, plus a small explicit-content set). Case-insensitive, word-boundary aware.
4. **Spam heuristics:** reject a title that is >70% uppercase letters (when it has ≥10 letters), or any field with excessive repeated punctuation (e.g. `!!!!`, `?????`) or a character repeated 6+ times.

Each rule returns a specific, user-facing `reason` so the employer can fix and resubmit.

**Route-level checks (not in the pure function, because they need the DB / Redis):**

5. **Duplicate guard:** in the create/edit route, reject if the same `ownerId` already has a listing with the same `title` + `org` (case-insensitive), excluding the row being edited.
6. **Rate limit:** reuse the existing per-user `getWriteRateLimit()` (40/min) plus a new `getPostRateLimit()` (e.g. 10 posts/day per user) to cap submission volume.

`validateSubmission` is exercised by Vitest unit tests covering each rule (pass + the specific failure for each).

## Employer Flows

All employer pages/routes require a signed-in `EMPLOYER` account (`occupationType === "EMPLOYER"`); other users are redirected to a short "this is for employers" notice or the sign-up page.

- **Post form — `/post`** (client form, early-2000s theme). Fields: title, type (dropdown of the 4 types), location, description (textarea), apply-URL (optional), deadline (optional free text, matching the existing string format), paid checkbox, target grades (multi-select chips from the fixed grade list), target interests (multi-select chips from the fixed interest list, max 5). `org` defaults to the employer's `companyName` (editable). On submit → `POST /api/opportunities`. On gate failure, the reason renders inline; on success, redirect to `/my-postings`.
- **My Postings — `/my-postings`** (server, auth+employer-gated). Lists the employer's own opportunities (via a `getOwnedOpportunities(userId)` accessor) with **Edit** (→ `/post/[id]/edit`) and **Delete** controls. Empty state prompts them to post their first.
- **Edit — `/post/[id]/edit`** reuses the post form, pre-filled; owner-only. On submit → `PATCH /api/opportunities/[id]`.
- **Delete** → `DELETE /api/opportunities/[id]`, owner-only.

## API Routes

- `POST /api/opportunities` — auth + employer guard → rate-limit (`getWriteRateLimit` + `getPostRateLimit`) → Zod parse → `validateSubmission` (400 + `reason` on fail) → duplicate guard (400) → `db.opportunity.create({ ...data, ownerId })` → return the new id.
- `PATCH /api/opportunities/[id]` — auth + employer guard → load the opportunity, 404 if missing, 403 if `ownerId !== session.user.id` → rate-limit → Zod parse → `validateSubmission` → duplicate guard (excluding this id) → `db.opportunity.update`.
- `DELETE /api/opportunities/[id]` — auth + employer guard → owner check (404/403) → `db.opportunity.delete`.

A new `opportunitySubmissionSchema` (Zod) in `lib/validations.ts` defines the accepted body for create/edit.

## Navigation & Gating

- The `(main)` layout nav gains a **"Post"** entry. Because the nav is a server component, it will fetch the session and show **"My Postings"** + **"Post"** only for `EMPLOYER` accounts (and the existing student-oriented links for everyone). This is a small, contained change to the layout.
- Server pages (`/post`, `/my-postings`, `/post/[id]/edit`) independently enforce the employer guard (defense in depth), so the nav change is purely cosmetic convenience.

## Integration (no changes required)

`getAllOpportunities`, `getOpportunityById`, the home "For You" matching, browse filters, the feed, and student save/apply already operate on the full `Opportunity` table. Employer-submitted listings appear in all of them automatically. The target-grades/target-interests captured on the form feed the existing Phase-1 matching scorer.

## Out of Scope (YAGNI)

- AI-based moderation (rule-based only for now; a Claude classifier can be layered on later).
- Human approval queue / moderation dashboard / appeals.
- Employer analytics (views, applicant counts).
- Editing/deleting the 9 ownerless seed listings through the employer UI.
- Image/logo uploads on listings.

## Build Order (for the plan)

1. Schema: add `ownerId` + relation + index; `db push`.
2. Pure moderation gate + Vitest tests; `opportunitySubmissionSchema`; `getPostRateLimit`.
3. DB accessors: `getOwnedOpportunities`, plus create/update/delete helpers (or inline in routes).
4. API routes: create, edit, delete (auth + employer + gate + owner checks).
5. Employer UI: post form, my-postings dashboard, edit page.
6. Nav: employer-conditional links.

Each step builds on the last; the feature is shippable once steps 1–5 are done (nav is polish).
