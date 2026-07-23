# Dual Signup Paths + Manual Company Approval — Design Spec

**Date:** 2026-07-23
**Status:** Approved (founder confirmed all four forks: separate signup paths, in-app admin dashboard, account created only after approval, mock phone OTP for now).
**Platform:** (name) — student opportunity platform (Next.js 16, Prisma 7/Neon, NextAuth v5, Resend).

## Model

Two distinct front doors, matched to two very different trust levels:

- **Individuals** (students looking for opportunities): low friction, self-serve, gated only by email + phone confirmation.
- **Companies** (posting opportunities): founder-reviewed by hand, invite-only in spirit. No company account exists until the founder personally approves the application.

This replaces the current setup where anyone can self-declare "Employer" during onboarding and immediately start posting with zero review. That onboarding path is removed as part of this change — leaving it in place would let anyone bypass the new approval gate entirely.

## Signup entry (`/sign-up`)

Becomes a chooser screen with two options: "I'm looking for opportunities" → `/sign-up/individual`, and "I'm hiring / posting opportunities" → `/sign-up/company`. The current signup form moves to `/sign-up/individual` unchanged apart from the additions below.

## Individual path

- Form gains one field: **phone number**, alongside the existing first/last name, email, password.
- On submit, the account is created immediately (as today), and a 6-digit OTP is generated and stored on the user row (`phoneOtpCode`, `phoneOtpExpiresAt`, 10-minute expiry).
- Redirect to a new `/verify-phone` page: OTP entry form plus a "resend code" action. Follows the same dev-mock convention as `/verify/mock` — an amber "DEV MOCK" box shows the code on-screen instead of actually texting it (no real SMS in v1).
- Email verification is unchanged (async link-click via the existing Resend flow, `/verify-email`).
- `lib/auth.ts`'s `authorize()` gets one more check: login is blocked until `phoneVerified` is also true (mirrors the existing `emailVerified` gate). Order between the two doesn't matter — whichever the user finishes last unblocks login.
- **Provider seam:** `lib/phone-otp.ts`, structurally identical to `lib/identity.ts` — a `PhoneOtpProvider` interface (`sendOtp(phone, code)`), a `mockProvider` (no-op; the code is shown in the UI instead of sent), and `getPhoneOtpProvider()` that throws on any `PHONE_OTP_PROVIDER` value other than `"mock"`. A real Twilio provider later is a new file implementing the interface plus flipping the env var — no call-site changes.
- `/onboarding/occupation` drops the "Employer / Company" card and its company-name sub-field. Only Student / Other remain. The route handler (`/api/user/onboarding/occupation`) drops `EMPLOYER` from its accepted enum values accordingly.

## Company path

- `/sign-up/company` form: company name, contact person's name, work email, website (optional), short description of what they're hiring for. **No password field** — nothing is created until approval.
- Submit validation:
  - If a `User` already exists with that email, reject with "an account already exists with this email."
  - If a `CompanyApplication` already exists for that email with status `PENDING` or `APPROVED`, reject with "you already have an application on file."
- On success: creates a `CompanyApplication` (`status: PENDING`), emails the founder a notification (to the address configured in `ADMIN_EMAILS`, see below) with the application details, and shows the applicant a static confirmation page ("Thanks — we'll review and email you").
- Rate-limited the same way `/api/auth/register` is (unauthenticated, abuse-prone endpoint).

## Admin review (`/admin/companies`)

- Access control: no new role system. A session's email is checked against `ADMIN_EMAILS`, a comma-separated env var. Anyone not on the list gets redirected away — same shape as the existing `getEmployerUserId()` gate pattern in `lib/employer.ts`, just checking an env allow-list instead of a DB flag, since there is exactly one reviewer today.
- Lists applications, most recent first, with a status filter (Pending / Approved / Rejected). Pending applications show Approve / Reject actions.
- **Approve:**
  1. Creates the real `User` row: `email` = work email, `name` = contact name, `occupationType: EMPLOYER`, `companyName` set, `phoneVerified: true` (the human review is this account's trust gate — it does not go through phone OTP), `emailVerified: null` (still unset — proven in step 3).
  2. Generates `setPasswordToken` + `setPasswordTokenExpires` (24h) on the `CompanyApplication`, sets `status: APPROVED`, `decidedAt: now()`.
  3. Emails the applicant a link to `/company/set-password?token=...`.
- **Reject:** sets `status: REJECTED`, `decidedAt: now()`. Emails the applicant a brief "not moving forward at this time" notice. No `User` row is ever created for a rejected application.
- Actions are rate-limited like other authenticated write endpoints (`getWriteRateLimit`).

## `/company/set-password`

- Token-gated form (same expiry-check shape as the existing `/api/auth/verify-email` token flow): looks up the `CompanyApplication` by `setPasswordToken`, 404s on missing/expired.
- On submit: hashes the password onto the `User` created at approval time, sets `emailVerified: new Date()` (clicking this link is proof of work-email ownership, same logic already used for the individual email-verify flow), clears the token fields on the application, redirects to `/sign-in`.

## Data model

```prisma
// User additions
phone              String?
phoneVerified      Boolean   @default(false)
phoneOtpCode       String?
phoneOtpExpiresAt  DateTime?

enum CompanyApplicationStatus {
  PENDING
  APPROVED
  REJECTED
}

model CompanyApplication {
  id                     String                    @id @default(cuid())
  companyName            String
  contactName            String
  workEmail              String
  website                String?
  description            String?
  status                 CompanyApplicationStatus  @default(PENDING)
  setPasswordToken       String?                   @unique
  setPasswordTokenExpires DateTime?
  createdAt              DateTime                  @default(now())
  decidedAt              DateTime?

  @@index([status])
  @@index([workEmail])
}
```

No relation from `CompanyApplication` to `User` — they're linked only by email, since the whole point is the `User` doesn't exist until approval.

## Emails (extend `lib/email.ts`)

- `sendCompanyApplicationNotification(adminEmail, application)` — to the founder, on submission.
- `sendCompanyApprovedEmail(to, setPasswordUrl)` — to the applicant, on approval.
- `sendCompanyRejectedEmail(to)` — to the applicant, on rejection.

## Out of scope v1

- Real SMS provider (Twilio) — seam is ready, wiring is a follow-up founder action (account + API keys).
- Multiple admins / a promotable admin role — single env-var allow-list is enough for one reviewer.
- Rejection reasons shown to the applicant, or a reapply flow.
- Editing a submitted company application before it's reviewed.
- Any change to existing employer-only gates (`getEmployerUserId()`, `/post`, `/my-postings`, `/api/opportunities`) — they already key off `occupationType === "EMPLOYER"`, which this feature still sets correctly at approval time, so they need no changes.
