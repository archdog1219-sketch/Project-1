# Two-Tier Identity (Signup + Opt-in ID Verification) — Design Spec

**Date:** 2026-07-12
**Status:** Approved (founder supplied the verification model; the three open forks were resolved: privileges v1 = trust signals + ranking; mock ID provider now with Stripe-Identity-shaped seam; no soft-cap on unverified users).
**Platform:** (name) — student opportunity platform (Next.js 16, Prisma 7/Neon, NextAuth v5, Resend).

## Model

Two tiers, LinkedIn-style: **get in cheaply, verify later for benefits.** Verification is opt-in and driven by a visible privilege delta — never required to sign up. One-account-per-person is **explicitly deferred** (deliberate, not an oversight).

## Tier 1 — Signup (low friction)

- **First + last name required at signup** (composed into the existing `User.name`). Small print: real name required by Terms, not verified at this stage. The onboarding basic-info step stops re-asking for name (shows it, still collects DOB + city).
- **Email confirmation:** keep the existing enforced Resend **link** flow (sign-in already blocks unverified accounts). Accepted deviation from the prompt's "code" wording — same guarantee.
- **SSO:** Google/Apple already live; provider-supplied names flow through the NextAuth adapter automatically.
- **`.edu` capture:** new `User.hasEduEmail` boolean set wherever a user record is created (credentials register route + NextAuth `events.createUser` for OAuth). Shown as a subtle 🎓 "school email" line on profiles; promotable to a school-verified badge later.
- **No phone/SMS** at base tier (uniqueness lever reserved for later).

## Tier 2 — Post-signup ID verification

- **Provider seam:** `lib/identity.ts` defines a Stripe-Identity-shaped interface (`createVerificationSession` → user completes flow → result recorded). v1 ships a **dev-mock provider**, clearly labeled in the UI, simulating the gov-ID + selfie steps. Swapping in Stripe Identity/Persona later = same interface + env keys.
- **Name-match is real logic now:** the legal name submitted in the verification flow must match `User.name` (case/whitespace-insensitive) or verification **fails** with that reason — this is what makes "real name" real, and it's enforced identically under the mock and any future vendor.
- **Data model:** `IdentityVerification` (one per user): `status PENDING|VERIFIED|FAILED`, `provider` ("mock" now), `providerRef?`, `nameMatched`, `issuingCountry?`, `failureReason?`, timestamps. Denormalized `User.idVerified` for cheap query paths. **No ID images or numbers are ever stored** — verification record only. Issuing country may be displayed (LinkedIn-style).
- **`/verify` page:** explains the payoff, notes checks are 18+ (HS users see it, mostly can't pass, and suffer **zero penalty** — no soft-cap anywhere). Entry points: profile page + a small nudge card.
- Rate-limited like other write endpoints.

## Privileges v1 (confirmed)

1. **✓ Verified badge** beside the name on: own/others' profile pages, feed items, the "students with similar interests" rail, and opportunity listings posted by verified employers.
2. **Visibility boost:**
   - Suggestions rail: verified users rank above unverified **at equal shared-interest counts** (tiebreak, not override — relevance still dominates).
   - For-You matching: listings from ID-verified owners get `VERIFIED_OWNER_BONUS = 1` (equal to the location weight, below one interest match at 3).
3. **No negative pressure:** unverified accounts keep today's full experience.

## Parked (deliberately, per the founder's decision log)

- One-account-per-person enforcement (SMS + VOIP blocking, or ID-hash dedup at the verified tier).
- High-school / minor verification handling (ID checks are adults-only; college-first bias accepted).
- Monetization tie-ins.
- Real vendor integration (Stripe Identity account + keys — founder action; the seam is ready).

## Out of Scope v1

DMs / messaging, connection limits, curated lists (referenced in the original privilege brainstorm but not yet features of this product), verified-only posting gates, displaying the liveness selfie as profile photo (needs the real vendor's photo output).
