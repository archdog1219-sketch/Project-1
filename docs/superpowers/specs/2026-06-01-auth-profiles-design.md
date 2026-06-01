# Auth + Profiles — Design Spec
**Date:** 2026-06-01
**Status:** Approved
**Scope:** User authentication, onboarding flow, and profile system. First sub-project of a student-focused opportunity platform (similar to Indeed, targeting high school and college students seeking jobs, internships, summer programs, and extracurricular opportunities).

---

## 1. Architecture

**Stack:**
- **Framework:** Next.js (App Router)
- **Auth:** NextAuth.js — sessions, CSRF, OAuth callbacks, email/password
- **Database:** PostgreSQL via Neon (Vercel-managed)
- **ORM:** Prisma — type-safe queries, schema migrations
- **File storage:** Vercel Blob (profile photos)

**Security layers:**
- Passwords hashed with bcrypt (NextAuth)
- Session tokens in signed, httpOnly, secure cookies — never accessible to JavaScript
- CSRF protection on all auth endpoints (NextAuth built-in)
- Age gate enforced server-side at account creation — not just UI
- Email verification required before any session is granted
- All API routes protected by middleware checking session before responding
- Rate limiting on login and sign-up endpoints (brute force protection)
- Neon database connection over SSL only — credentials in Vercel env vars, never in code
- HTTP security headers set globally: `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Content-Security-Policy`

---

## 2. Data Model

### User
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `signupEmail` | String | Used for login/verification only — never shown on profile |
| `contactEmail` | String? | Optional — shown on profile only if privacy toggle is on |
| `passwordHash` | String? | Null for OAuth-only accounts |
| `emailVerified` | DateTime? | Null until verified |
| `name` | String | Full name |
| `username` | String? | Set after onboarding |
| `dateOfBirth` | Date | Server-side only — never exposed in API responses |
| `city` | String? | City only — no zip, no address |
| `occupationType` | Enum | `STUDENT_HS`, `STUDENT_COLLEGE`, `EMPLOYER`, `OTHER` |
| `schoolLevel` | String? | "High School" or "College" (students only) |
| `graduationYear` | Int? | |
| `degree` | String? | College students only — typed by user |
| `companyName` | String? | Employers only — typed by user |
| `school` | String? | Added during profile editing, not onboarding |
| `bio` | String? | Max 300 characters |
| `skills` | String[] | Tag-style array |
| `interests` | String[] | Tag-style array |
| `profilePhoto` | String? | Vercel Blob URL |
| `contactEmailVisible` | Boolean | Default false — user must explicitly enable |
| `createdAt` | DateTime | |

### Session *(NextAuth managed)*
`id`, `userId`, `expires`, `sessionToken`

### Account *(NextAuth managed — OAuth)*
`id`, `userId`, `provider` (google/apple), `providerAccountId`

### VerificationToken *(NextAuth managed)*
`identifier`, `token`, `expires`

---

## 3. Authentication

**Methods:**
- Email + password (min 10 chars, must include uppercase, lowercase, and number)
- Social login: Google, Apple (via NextAuth OAuth providers)

**Email verification:**
- Required before any session is granted
- Token expires after 24 hours
- Resend available after 60 second cooldown

**Password requirements:**
- Minimum 10 characters
- Must include uppercase, lowercase, and a number
- *(HaveIBeenPwned breach check to be added in a future update as user base grows)*

**Minimum age:** 16 years old — enforced server-side at Step 3 of onboarding. Under-16 accounts are soft-blocked (flagged, not deleted).

---

## 4. Onboarding Flow

**Step 1 — Create Account**
- Email + password + confirm password
- OR Continue with Google / Continue with Apple
- On submit: account created, verification email sent, user sees "Check your email" screen

**Step 2 — Verify Email**
- User clicks link → token validated server-side → session granted

**Step 3 — Basic Info**
- Full name, date of birth, city
- Age gate enforced here server-side

**Step 4 — Occupation**
Selectable cards (icon + title + description):
- 🎓 Student — "Looking for jobs, internships or programs"
- 🏢 Employer / Company — "Posting opportunities, hiring students" → prompted to type company name
- 👤 Other — "Something else" → *(to be expanded in future session — will include Nonprofit/Community Org)*

**Step 5 — Student Details** *(students only)*
- High School or College
- Year: Freshman / Sophomore / Junior / Senior
- College only: degree field (typed by user)

**After onboarding:** User lands on their profile page. Remaining fields (username, school, skills, interests, photo, contact email) completed at any time via profile editing.

---

## 5. API Routes

### Public (no session required)
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account. Rate limited: 5 attempts/IP/hour |
| POST | `/api/auth/[...nextauth]` | NextAuth handler (login, OAuth, callbacks) |
| GET | `/api/auth/verify-email?token=` | Email verification |

### Protected (session required — middleware blocks unauthenticated requests)
| Method | Route | Description |
|---|---|---|
| GET | `/api/profile/[id]` | View a profile |
| PATCH | `/api/profile` | Update own profile |
| POST | `/api/profile/photo` | Upload profile photo |
| GET | `/api/user/me` | Get own account data |

**Rules across all routes:**
- Middleware checks session on every protected route before any logic runs
- Users can only edit their own profile — server enforces `session.userId === profile.userId`
- All inputs validated and sanitized server-side
- API responses never include `passwordHash`, `dateOfBirth`, or `signupEmail`
- All env vars stored in Vercel — never hardcoded

---

## 6. Profile Page Layout

**Sidebar + Sections layout.**

### Left Sidebar
- Profile photo (click to upload)
- Full name
- Occupation badge (e.g. "High School Student" or "Employer @ Nike")
- City
- Member since date

### Right Side Sections
- **About** — optional bio, 300 char limit
- **Education** — school name, graduation year, degree (where applicable). School added here during profile editing — not at onboarding
- **Skills** — tag-style chips, user adds one at a time
- **Interests** — tag-style chips, same as skills
- **Contact** — contactEmail field, editable by user (separate from signup email), hidden by default — user must toggle on to display

### Editing
- Clicking any section opens inline edit mode for that section only
- Changes save on confirm with loading state and success/error feedback
- Profile photo uploads to Vercel Blob; old photo deleted on replacement
- No raw HTML accepted in any field (XSS protection)
- `dateOfBirth` never shown on profile — internal use only

---

## 7. Future Work (out of scope for this phase)
- Resume / CV upload field on profile
- Expand "Other" occupation type (Nonprofit, Community Org, etc.) — **REMINDER: define full list of Other subtypes in a future session**
- HaveIBeenPwned password breach check
- School as a searchable/verified entity (separate from free-text school name on profile)
- MFA / two-factor authentication

---

## 8. Decision Log

| Decision | Choice | Notes |
|---|---|---|
| Auth methods | Email/password + Google + Apple | Via NextAuth.js |
| Auth library | NextAuth.js | Free, open source, battle-tested |
| Database | PostgreSQL via Neon | Vercel-managed, free tier |
| ORM | Prisma | Type-safe, migration support |
| Sign-up flow | 5-step onboarding (Step 5 students only) | Guided, not overwhelming |
| Occupation types | Student (HS/College), Employer, Other | School removed from sign-up |
| Student sub-prompts | Dedicated extra step (Step 4) | Level → year → degree |
| Profile layout | Sidebar + Sections | Best for scannability |
| Occupation UI | Selectable cards with icon + description | Clear for first-time users |
| Location granularity | City only | No zip, no address |
| Minimum age | 16 years old | Server-side enforced |
| Email verification | Required before access | 24hr token, 60s resend cooldown |
| Password requirements | Min 10 chars, upper + lower + number | Upgrade to breach check later |
| Contact email | Separate editable field, hidden by default | Not locked to signup email |
| Resume field | Deferred | Add in future session |
| Profile photo storage | Vercel Blob | Old photo deleted on replacement |
