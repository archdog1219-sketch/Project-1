# Auth + Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete authentication system, onboarding flow, and profile page for the student opportunity platform.

**Architecture:** NextAuth.js handles sessions, OAuth, and email/password with bcrypt. Prisma manages the PostgreSQL schema on Neon. The onboarding flow is a 5-step wizard (Step 5 students only) guarded by middleware that blocks unauthenticated access to all protected routes. Profile pages use a sidebar + sections layout with inline editing.

**Tech Stack:** Next.js 16 (App Router), NextAuth.js, Prisma, PostgreSQL (Neon), Tailwind CSS 4, TypeScript, Zod (validation), Resend (email), Vercel Blob (profile photos), bcryptjs, next-safe-action (rate limiting via upstash/ratelimit)

---

## File Map

```
prisma/
  schema.prisma                        # DB schema — User, Session, Account, VerificationToken

lib/
  db.ts                                # Prisma client singleton
  auth.ts                              # NextAuth config (providers, callbacks, adapter)
  auth-utils.ts                        # Server-side helpers: getSession, requireSession, ageCheck
  validations.ts                       # Zod schemas for all forms
  email.ts                             # Resend email sender (verification email)
  rate-limit.ts                        # Upstash rate limiter helper

middleware.ts                          # Route protection — blocks unauthenticated access

app/
  layout.tsx                           # Root layout (update title/meta)
  page.tsx                             # Landing page (replace boilerplate)

  (auth)/                              # Auth route group — no shared layout needed
    layout.tsx                         # Centered card layout for auth pages
    sign-up/page.tsx                   # Step 1: email + password form
    verify-email/page.tsx              # Step 2: "check your email" screen
    sign-in/page.tsx                   # Sign in page
    auth-error/page.tsx                # NextAuth error display page

  onboarding/                          # Onboarding wizard (protected)
    layout.tsx                         # Progress bar layout
    basic-info/page.tsx                # Step 3: name, DOB, city
    occupation/page.tsx                # Step 4: occupation selector
    student-details/page.tsx           # Step 5: HS/college, year, degree

  profile/
    [id]/page.tsx                      # Public profile view
    edit/page.tsx                      # Own profile editing (protected)

  api/
    auth/
      [...nextauth]/route.ts           # NextAuth handler
      verify-email/route.ts            # GET — token validation
    profile/
      route.ts                         # PATCH — update own profile
      photo/route.ts                   # POST — upload profile photo
    user/
      me/route.ts                      # GET — own account data

components/
  ui/
    button.tsx                         # Reusable button (variants: primary, secondary, ghost)
    input.tsx                          # Reusable input with label + error state
    tag-input.tsx                      # Skills/interests chip input
    occupation-card.tsx                # Selectable occupation card
  profile/
    sidebar.tsx                        # Profile sidebar (photo, name, badge, city)
    about-section.tsx                  # About bio section with inline edit
    education-section.tsx              # Education section with inline edit
    skills-section.tsx                 # Skills chips section with inline edit
    interests-section.tsx              # Interests chips section with inline edit
    contact-section.tsx                # Contact email section with privacy toggle
  onboarding/
    progress-bar.tsx                   # Step progress indicator
    student-level-selector.tsx         # HS vs College choice cards
```

---

## Task 1: Install dependencies and configure environment

**Files:**
- Modify: `package.json`
- Create: `.env.local` (local only — never committed)
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Install all required packages**

```bash
cd /Users/archerwebb/Documents/project-1
npm install next-auth@beta @auth/prisma-adapter prisma @prisma/client bcryptjs zod resend @vercel/blob
npm install --save-dev @types/bcryptjs
```

Expected: packages install with no errors.

- [ ] **Step 2: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

Expected: creates `prisma/schema.prisma` and adds `DATABASE_URL` to `.env`.

- [ ] **Step 3: Set up environment variables**

Add these to `.env.local` (replace placeholder values with real ones from Vercel dashboard + Neon console):

```bash
# Database — get from Neon dashboard (Vercel integration)
DATABASE_URL="postgresql://..."

# NextAuth — generate with: openssl rand -base64 32
AUTH_SECRET="replace-with-generated-secret"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth — create at console.cloud.google.com
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"

# Apple OAuth — create at developer.apple.com
AUTH_APPLE_ID="your-apple-client-id"
AUTH_APPLE_SECRET="your-apple-client-secret"

# Resend — get from resend.com dashboard
RESEND_API_KEY="re_..."
EMAIL_FROM="noreply@yourdomain.com"

# Upstash Redis — get from upstash.com (for rate limiting)
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
```

> **Note:** Pull Vercel env vars locally after provisioning Neon: `vercel env pull .env.local`

- [ ] **Step 4: Install Upstash rate limit package**

```bash
npm install @upstash/ratelimit @upstash/redis
```

- [ ] **Step 5: Verify Node can resolve all imports (no test needed yet — just a sanity check)**

```bash
node -e "require('./node_modules/next-auth/package.json')" && echo "next-auth OK"
node -e "require('./node_modules/@prisma/client/package.json')" && echo "prisma OK"
node -e "require('./node_modules/zod/package.json')" && echo "zod OK"
```

Expected: three "OK" lines printed.

---

## Task 2: Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Write the schema**

Replace the contents of `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum OccupationType {
  STUDENT_HS
  STUDENT_COLLEGE
  EMPLOYER
  OTHER
}

model User {
  id                   String    @id @default(cuid())
  signupEmail          String    @unique
  contactEmail         String?
  contactEmailVisible  Boolean   @default(false)
  passwordHash         String?
  emailVerified        DateTime?
  name                 String?
  username             String?   @unique
  dateOfBirth          DateTime?
  city                 String?
  occupationType       OccupationType?
  schoolLevel          String?
  graduationYear       Int?
  degree               String?
  companyName          String?
  school               String?
  bio                  String?
  skills               String[]
  interests            String[]
  profilePhoto         String?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  accounts  Account[]
  sessions  Session[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

- [ ] **Step 2: Push schema to Neon database**

```bash
npx prisma db push
```

Expected output includes: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Generate Prisma client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma package.json package-lock.json
git commit -m "feat: add prisma schema for auth and profiles"
```

---

## Task 3: Prisma client + core lib files

**Files:**
- Create: `lib/db.ts`
- Create: `lib/validations.ts`
- Create: `lib/auth-utils.ts`

- [ ] **Step 1: Create the Prisma client singleton**

Create `lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 2: Create Zod validation schemas**

Create `lib/validations.ts`:

```typescript
import { z } from "zod";

export const signUpSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    password: z
      .string()
      .min(10, "Password must be at least 10 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const basicInfoSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  dateOfBirth: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), "Please enter a valid date"),
  city: z.string().min(2, "City must be at least 2 characters").max(100),
});

export const occupationSchema = z.discriminatedUnion("occupationType", [
  z.object({
    occupationType: z.literal("STUDENT_HS"),
  }),
  z.object({
    occupationType: z.literal("STUDENT_COLLEGE"),
  }),
  z.object({
    occupationType: z.literal("EMPLOYER"),
    companyName: z.string().min(1, "Company name is required").max(200),
  }),
  z.object({
    occupationType: z.literal("OTHER"),
  }),
]);

export const studentDetailsSchema = z.object({
  schoolLevel: z.enum(["High School", "College"]),
  graduationYear: z
    .number()
    .int()
    .min(new Date().getFullYear())
    .max(new Date().getFullYear() + 10),
  degree: z.string().max(200).optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
    .optional(),
  city: z.string().min(2).max(100).optional(),
  bio: z.string().max(300, "Bio must be 300 characters or less").optional(),
  school: z.string().max(200).optional(),
  graduationYear: z.number().int().optional(),
  degree: z.string().max(200).optional(),
  skills: z.array(z.string().min(1).max(50)).max(20).optional(),
  interests: z.array(z.string().min(1).max(50)).max(20).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactEmailVisible: z.boolean().optional(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type BasicInfoInput = z.infer<typeof basicInfoSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
```

- [ ] **Step 3: Create auth utility helpers**

Create `lib/auth-utils.ts`:

```typescript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Returns session or null. Use in Server Components for optional auth.
 */
export async function getSession() {
  return await auth();
}

/**
 * Returns session or redirects to sign-in. Use in protected Server Components.
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  return session;
}

/**
 * Returns true if the given date of birth is 16 or older today.
 */
export function isOldEnough(dateOfBirth: Date): boolean {
  const today = new Date();
  const minAge = new Date(
    today.getFullYear() - 16,
    today.getMonth(),
    today.getDate()
  );
  return dateOfBirth <= minAge;
}

/**
 * Strips sensitive fields before sending user data to the client.
 */
export function sanitizeUser(user: {
  id: string;
  signupEmail: string;
  passwordHash: string | null;
  dateOfBirth: Date | null;
  contactEmailVisible: boolean;
  contactEmail: string | null;
  [key: string]: unknown;
}) {
  const { passwordHash, dateOfBirth, signupEmail, ...safe } = user;
  return {
    ...safe,
    contactEmail: user.contactEmailVisible ? user.contactEmail : null,
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/db.ts lib/validations.ts lib/auth-utils.ts
git commit -m "feat: add prisma singleton, zod schemas, and auth utils"
```

---

## Task 4: NextAuth configuration

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create NextAuth config**

Create `lib/auth.ts`:

```typescript
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signInSchema } from "@/lib/validations";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    Apple({
      clientId: process.env.AUTH_APPLE_ID!,
      clientSecret: process.env.AUTH_APPLE_SECRET!,
    }),
    Credentials({
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { signupEmail: parsed.data.email },
        });

        if (!user || !user.passwordHash) return null;
        if (!user.emailVerified) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.signupEmail,
          name: user.name,
          image: user.profilePhoto,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
    error: "/auth-error",
    verifyRequest: "/verify-email",
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
});
```

- [ ] **Step 2: Create the NextAuth route handler**

Create `app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 3: Extend NextAuth types for session.user.id**

Create `types/next-auth.d.ts`:

```typescript
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts app/api/auth types/next-auth.d.ts
git commit -m "feat: configure NextAuth with credentials and OAuth providers"
```

---

## Task 5: Email verification API route + email sender

**Files:**
- Create: `lib/email.ts`
- Create: `app/api/auth/verify-email/route.ts`

- [ ] **Step 1: Create Resend email helper**

Create `lib/email.ts`:

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<void> {
  const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`;

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: "Verify your email address",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Verify your email</h2>
        <p>Click the button below to verify your email address. This link expires in 24 hours.</p>
        <a href="${verifyUrl}"
           style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">
          Verify Email
        </a>
        <p style="color:#64748b;font-size:14px;margin-top:16px;">
          If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
```

- [ ] **Step 2: Create the verify-email route handler**

Create `app/api/auth/verify-email/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/auth-error?error=missing-token", request.url));
  }

  const verificationToken = await db.verificationToken.findUnique({
    where: { token },
  });

  if (!verificationToken) {
    return NextResponse.redirect(new URL("/auth-error?error=invalid-token", request.url));
  }

  if (verificationToken.expires < new Date()) {
    await db.verificationToken.delete({ where: { token } });
    return NextResponse.redirect(new URL("/auth-error?error=expired-token", request.url));
  }

  await db.user.update({
    where: { signupEmail: verificationToken.identifier },
    data: { emailVerified: new Date() },
  });

  await db.verificationToken.delete({ where: { token } });

  return NextResponse.redirect(new URL("/onboarding/basic-info", request.url));
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/email.ts app/api/auth/verify-email
git commit -m "feat: add email sender and verify-email route"
```

---

## Task 6: Rate limiting + registration API route

**Files:**
- Create: `lib/rate-limit.ts`
- Create: `app/api/auth/register/route.ts`

- [ ] **Step 1: Create rate limiter helper**

Create `lib/rate-limit.ts`:

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const registrationRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  prefix: "ratelimit:register",
});

export const loginRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "15 m"),
  prefix: "ratelimit:login",
});
```

- [ ] **Step 2: Create registration route**

Create `app/api/auth/register/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { signUpSchema } from "@/lib/validations";
import { sendVerificationEmail } from "@/lib/email";
import { registrationRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Rate limit by IP
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await registrationRateLimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  // Check for existing account
  const existing = await db.user.findUnique({
    where: { signupEmail: email },
  });
  if (existing) {
    return NextResponse.json(
      { error: { email: ["An account with this email already exists"] } },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Create user
  await db.user.create({
    data: {
      signupEmail: email,
      passwordHash,
    },
  });

  // Create verification token (24hr expiry)
  const token = nanoid(32);
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.verificationToken.create({
    data: { identifier: email, token, expires },
  });

  await sendVerificationEmail(email, token);

  return NextResponse.json({ success: true }, { status: 201 });
}
```

- [ ] **Step 3: Install nanoid**

```bash
npm install nanoid
```

- [ ] **Step 4: Commit**

```bash
git add lib/rate-limit.ts app/api/auth/register package.json package-lock.json
git commit -m "feat: add registration endpoint with rate limiting and email verification"
```

---

## Task 7: Middleware — route protection + security headers

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Write middleware**

Create `middleware.ts` at the project root:

```typescript
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/sign-in",
  "/sign-up",
  "/verify-email",
  "/auth-error",
  "/api/auth",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
    ].join("; ")
  );
  return response;
}

export default auth(function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = (req as any).auth;

  if (!isPublicPath(pathname) && !session) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return addSecurityHeaders(NextResponse.redirect(signInUrl));
  }

  return addSecurityHeaders(NextResponse.next());
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
```

- [ ] **Step 2: Verify middleware compiles**

```bash
npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add route protection middleware with security headers"
```

---

## Task 8: Reusable UI components

**Files:**
- Create: `components/ui/button.tsx`
- Create: `components/ui/input.tsx`
- Create: `components/ui/tag-input.tsx`
- Create: `components/ui/occupation-card.tsx`
- Create: `components/onboarding/progress-bar.tsx`

- [ ] **Step 1: Button component**

Create `components/ui/button.tsx`:

```typescript
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", isLoading, children, className = "", disabled, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
      primary: "bg-indigo-600 text-white hover:bg-indigo-700 px-5 py-2.5",
      secondary:
        "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 px-5 py-2.5",
      ghost: "text-gray-600 hover:bg-gray-100 px-4 py-2",
    };
    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
```

- [ ] **Step 2: Input component**

Create `components/ui/input.tsx`:

```typescript
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-gray-700"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${
            error ? "border-red-400" : "border-gray-300"
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
```

- [ ] **Step 3: Tag input component (skills / interests)**

Create `components/ui/tag-input.tsx`:

```typescript
"use client";
import { useState, KeyboardEvent } from "react";

interface TagInputProps {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
}

export function TagInput({
  label,
  tags,
  onChange,
  placeholder = "Type and press Enter",
  maxTags = 20,
}: TagInputProps) {
  const [input, setInput] = useState("");

  function addTag() {
    const trimmed = input.trim();
    if (!trimmed || tags.includes(trimmed) || tags.length >= maxTags) return;
    onChange([...tags, trimmed]);
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
    if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="min-h-[44px] flex flex-wrap gap-2 rounded-lg border border-gray-300 px-3 py-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-0.5 text-sm font-medium text-indigo-700"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-indigo-400 hover:text-indigo-700"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="min-w-[120px] flex-1 text-sm outline-none bg-transparent"
        />
      </div>
      <p className="text-xs text-gray-400">{tags.length}/{maxTags} added</p>
    </div>
  );
}
```

- [ ] **Step 4: Occupation card component**

Create `components/ui/occupation-card.tsx`:

```typescript
"use client";

interface OccupationCardProps {
  icon: string;
  title: string;
  description: string;
  value: string;
  selected: boolean;
  onSelect: (value: string) => void;
}

export function OccupationCard({
  icon,
  title,
  description,
  value,
  selected,
  onSelect,
}: OccupationCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        selected
          ? "border-indigo-500 bg-indigo-50"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </button>
  );
}
```

- [ ] **Step 5: Progress bar component**

Create `components/onboarding/progress-bar.tsx`:

```typescript
interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  return (
    <div className="flex gap-2" role="progressbar" aria-valuenow={currentStep} aria-valuemax={totalSteps}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            i < currentStep ? "bg-indigo-600" : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add components/
git commit -m "feat: add reusable UI components (button, input, tag-input, occupation-card, progress-bar)"
```

---

## Task 9: Auth layout + sign-up page

**Files:**
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/sign-up/page.tsx`
- Create: `app/(auth)/verify-email/page.tsx`
- Create: `app/(auth)/auth-error/page.tsx`

- [ ] **Step 1: Auth layout (centered card)**

Create `app/(auth)/layout.tsx`:

```typescript
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">OpportuniPath</h1>
          <p className="text-sm text-gray-500 mt-1">Your next opportunity starts here</p>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Sign-up page**

Create `app/(auth)/sign-up/page.tsx`:

```typescript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signUpSchema } from "@/lib/validations";

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password, confirmPassword: form.confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.error === "object") {
          setErrors(data.error);
        } else {
          setServerError(data.error ?? "Something went wrong. Please try again.");
        }
        return;
      }
      router.push("/verify-email?email=" + encodeURIComponent(form.email));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Create your account</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          error={errors.email?.[0]}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          error={errors.password?.[0]}
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
          error={errors.confirmPassword?.[0]}
        />
        {serverError && (
          <p className="text-sm text-red-500">{serverError}</p>
        )}
        <Button type="submit" isLoading={isLoading} className="w-full mt-2">
          Create account
        </Button>
      </form>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-sm text-gray-400">or continue with</span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => signIn("google", { callbackUrl: "/onboarding/basic-info" })}
        >
          Continue with Google
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => signIn("apple", { callbackUrl: "/onboarding/basic-info" })}
        >
          Continue with Apple
        </Button>
      </div>
      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-indigo-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verify email holding page**

Create `app/(auth)/verify-email/page.tsx`:

```typescript
import Link from "next/link";

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  return (
    <div className="text-center">
      <div className="text-5xl mb-4">📬</div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h2>
      <p className="text-gray-500 mb-1">
        We sent a verification link to
      </p>
      {searchParams.email && (
        <p className="font-medium text-gray-900 mb-4">{searchParams.email}</p>
      )}
      <p className="text-sm text-gray-400 mb-6">
        The link expires in 24 hours. Check your spam folder if you don&apos;t see it.
      </p>
      <Link href="/sign-in" className="text-sm text-indigo-600 hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Auth error page**

Create `app/(auth)/auth-error/page.tsx`:

```typescript
import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  "missing-token": "The verification link is missing. Please request a new one.",
  "invalid-token": "This verification link is invalid or has already been used.",
  "expired-token": "This verification link has expired. Please request a new one.",
  default: "Something went wrong. Please try again.",
};

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const message =
    ERROR_MESSAGES[searchParams.error ?? ""] ?? ERROR_MESSAGES.default;

  return (
    <div className="text-center">
      <div className="text-5xl mb-4">⚠️</div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Something went wrong
      </h2>
      <p className="text-gray-500 mb-6">{message}</p>
      <Link
        href="/sign-up"
        className="text-sm font-medium text-indigo-600 hover:underline"
      >
        Back to sign up
      </Link>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add app/\(auth\)/
git commit -m "feat: add auth layout, sign-up page, verify-email and auth-error pages"
```

---

## Task 10: Sign-in page

**Files:**
- Create: `app/(auth)/sign-in/page.tsx`

- [ ] **Step 1: Sign-in page**

Create `app/(auth)/sign-in/page.tsx`:

```typescript
"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signInSchema } from "@/lib/validations";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/profile";
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    const parsed = signInSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (result?.error) {
        setServerError("Invalid email or password.");
        return;
      }
      router.push(callbackUrl);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          error={errors.email?.[0]}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          error={errors.password?.[0]}
        />
        {serverError && <p className="text-sm text-red-500">{serverError}</p>}
        <Button type="submit" isLoading={isLoading} className="w-full mt-2">
          Sign in
        </Button>
      </form>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-sm text-gray-400">or</span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => signIn("google", { callbackUrl })}
        >
          Continue with Google
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => signIn("apple", { callbackUrl })}
        >
          Continue with Apple
        </Button>
      </div>
      <p className="text-center text-sm text-gray-500 mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="font-medium text-indigo-600 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/sign-in
git commit -m "feat: add sign-in page with credentials and OAuth"
```

---

## Task 11: Onboarding layout + Step 3 (Basic Info)

**Files:**
- Create: `app/onboarding/layout.tsx`
- Create: `app/onboarding/basic-info/page.tsx`

- [ ] **Step 1: Onboarding layout with progress bar**

Create `app/onboarding/layout.tsx`:

```typescript
import { ProgressBar } from "@/components/onboarding/progress-bar";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-8">
          <p className="text-sm font-medium text-indigo-600 mb-3">Setting up your profile</p>
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Basic Info page (Step 3)**

Create `app/onboarding/basic-info/page.tsx`:

```typescript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import { basicInfoSchema } from "@/lib/validations";

export default function BasicInfoPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", dateOfBirth: "", city: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    const parsed = basicInfoSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setIsLoading(true);
    try {
      const res = await fetch("/api/user/onboarding/basic-info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/onboarding/occupation");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <ProgressBar currentStep={1} totalSteps={4} />
      <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-1">Tell us about yourself</h2>
      <p className="text-sm text-gray-500 mb-6">Step 1 of 4 — Basic info</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Full name"
          type="text"
          autoComplete="name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          error={errors.name?.[0]}
        />
        <Input
          label="Date of birth"
          type="date"
          value={form.dateOfBirth}
          onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
          error={errors.dateOfBirth?.[0]}
        />
        <Input
          label="City"
          type="text"
          placeholder="e.g. Chicago"
          value={form.city}
          onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          error={errors.city?.[0]}
        />
        {serverError && <p className="text-sm text-red-500">{serverError}</p>}
        <Button type="submit" isLoading={isLoading} className="w-full mt-2">
          Continue →
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create the basic-info onboarding API route**

Create `app/api/user/onboarding/basic-info/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { basicInfoSchema } from "@/lib/validations";
import { isOldEnough } from "@/lib/auth-utils";

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = basicInfoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const dob = new Date(parsed.data.dateOfBirth);
  if (!isOldEnough(dob)) {
    return NextResponse.json(
      { error: "You must be at least 16 years old to use this platform." },
      { status: 403 }
    );
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      name: parsed.data.name,
      dateOfBirth: dob,
      city: parsed.data.city,
    },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Commit**

```bash
git add app/onboarding/ app/api/user/
git commit -m "feat: add onboarding layout and basic-info step with age gate"
```

---

## Task 12: Onboarding Step 4 (Occupation) + Step 5 (Student Details)

**Files:**
- Create: `app/onboarding/occupation/page.tsx`
- Create: `app/onboarding/student-details/page.tsx`
- Create: `app/api/user/onboarding/occupation/route.ts`
- Create: `app/api/user/onboarding/student-details/route.ts`
- Create: `components/onboarding/student-level-selector.tsx`

- [ ] **Step 1: Occupation page (Step 4)**

Create `app/onboarding/occupation/page.tsx`:

```typescript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { OccupationCard } from "@/components/ui/occupation-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/onboarding/progress-bar";

const OCCUPATIONS = [
  {
    value: "STUDENT",
    icon: "🎓",
    title: "Student",
    description: "Looking for jobs, internships or programs",
  },
  {
    value: "EMPLOYER",
    icon: "🏢",
    title: "Employer / Company",
    description: "Posting opportunities, hiring students",
  },
  {
    value: "OTHER",
    icon: "👤",
    title: "Other",
    description: "Something else",
  },
];

export default function OccupationPage() {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (selected === "EMPLOYER" && !companyName.trim()) {
      setCompanyError("Company name is required");
      return;
    }
    setCompanyError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/user/onboarding/occupation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occupationType: selected, companyName: companyName.trim() || undefined }),
      });
      if (!res.ok) return;

      if (selected === "STUDENT") {
        router.push("/onboarding/student-details");
      } else {
        router.push("/profile/edit");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <ProgressBar currentStep={2} totalSteps={4} />
      <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-1">What best describes you?</h2>
      <p className="text-sm text-gray-500 mb-6">Step 2 of 4 — Occupation</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {OCCUPATIONS.map((occ) => (
          <OccupationCard
            key={occ.value}
            {...occ}
            selected={selected === occ.value}
            onSelect={setSelected}
          />
        ))}
        {selected === "EMPLOYER" && (
          <Input
            label="Company name"
            type="text"
            placeholder="e.g. Acme Corp"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            error={companyError}
          />
        )}
        <Button
          type="submit"
          isLoading={isLoading}
          disabled={!selected}
          className="w-full mt-2"
        >
          Continue →
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Occupation API route**

Create `app/api/user/onboarding/occupation/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { OccupationType } from "@prisma/client";

const schema = z.object({
  occupationType: z.enum(["STUDENT", "EMPLOYER", "OTHER"]),
  companyName: z.string().max(200).optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { occupationType, companyName } = parsed.data;

  // Map STUDENT to a placeholder — will be updated in student-details step
  const dbOccupationType =
    occupationType === "STUDENT"
      ? OccupationType.STUDENT_HS
      : occupationType === "EMPLOYER"
      ? OccupationType.EMPLOYER
      : OccupationType.OTHER;

  await db.user.update({
    where: { id: session.user.id },
    data: {
      occupationType: dbOccupationType,
      companyName: companyName ?? null,
    },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Student level selector component**

Create `components/onboarding/student-level-selector.tsx`:

```typescript
"use client";

interface StudentLevelSelectorProps {
  selected: "High School" | "College" | "";
  onSelect: (level: "High School" | "College") => void;
}

export function StudentLevelSelector({
  selected,
  onSelect,
}: StudentLevelSelectorProps) {
  const options = [
    { value: "High School" as const, icon: "🏫", label: "High School" },
    { value: "College" as const, icon: "🎓", label: "College" },
  ];

  return (
    <div className="flex gap-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          className={`flex-1 flex flex-col items-center gap-2 rounded-xl border-2 p-5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            selected === opt.value
              ? "border-indigo-500 bg-indigo-50"
              : "border-gray-200 bg-white hover:border-gray-300"
          }`}
        >
          <span className="text-3xl">{opt.icon}</span>
          <span className="font-semibold text-gray-900">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Student details page (Step 5)**

Create `app/onboarding/student-details/page.tsx`:

```typescript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { StudentLevelSelector } from "@/components/onboarding/student-level-selector";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/onboarding/progress-bar";

const YEARS = ["Freshman", "Sophomore", "Junior", "Senior"];

export default function StudentDetailsPage() {
  const router = useRouter();
  const [level, setLevel] = useState<"High School" | "College" | "">("");
  const [year, setYear] = useState("");
  const [degree, setDegree] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!level) e.level = "Please select your level";
    if (!year) e.year = "Please select your year";
    if (level === "College" && !degree.trim()) e.degree = "Please enter your degree";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/user/onboarding/student-details", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolLevel: level,
          graduationYear: new Date().getFullYear() + (YEARS.indexOf(year) === -1 ? 0 : 3 - YEARS.indexOf(year)),
          degree: level === "College" ? degree.trim() : undefined,
        }),
      });
      if (!res.ok) return;
      router.push("/profile/edit");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <ProgressBar currentStep={4} totalSteps={4} />
      <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-1">Tell us about your education</h2>
      <p className="text-sm text-gray-500 mb-6">Step 4 of 4 — Student details</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">High school or college?</p>
          <StudentLevelSelector selected={level} onSelect={setLevel} />
          {errors.level && <p className="text-xs text-red-500 mt-1">{errors.level}</p>}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">What year are you in?</p>
          <div className="flex gap-2 flex-wrap">
            {YEARS.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  year === y
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
          {errors.year && <p className="text-xs text-red-500 mt-1">{errors.year}</p>}
        </div>
        {level === "College" && (
          <Input
            label="What degree are you pursuing?"
            type="text"
            placeholder="e.g. Computer Science, Business Administration"
            value={degree}
            onChange={(e) => setDegree(e.target.value)}
            error={errors.degree}
          />
        )}
        <Button type="submit" isLoading={isLoading} className="w-full mt-2">
          Finish setup →
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Student details API route**

Create `app/api/user/onboarding/student-details/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { OccupationType } from "@prisma/client";

const schema = z.object({
  schoolLevel: z.enum(["High School", "College"]),
  graduationYear: z.number().int().min(2020).max(2040),
  degree: z.string().max(200).optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { schoolLevel, graduationYear, degree } = parsed.data;
  const occupationType =
    schoolLevel === "High School"
      ? OccupationType.STUDENT_HS
      : OccupationType.STUDENT_COLLEGE;

  await db.user.update({
    where: { id: session.user.id },
    data: {
      occupationType,
      schoolLevel,
      graduationYear,
      degree: degree ?? null,
    },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 6: Commit**

```bash
git add app/onboarding/occupation app/onboarding/student-details app/api/user/onboarding components/onboarding/student-level-selector.tsx
git commit -m "feat: add occupation and student-details onboarding steps"
```

---

## Task 13: Profile API routes

**Files:**
- Create: `app/api/user/me/route.ts`
- Create: `app/api/profile/route.ts`
- Create: `app/api/profile/[id]/route.ts`
- Create: `app/api/profile/photo/route.ts`

- [ ] **Step 1: /api/user/me**

Create `app/api/user/me/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sanitizeUser } from "@/lib/auth-utils";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      signupEmail: true,
      contactEmail: true,
      contactEmailVisible: true,
      passwordHash: true,
      dateOfBirth: true,
      name: true,
      username: true,
      city: true,
      occupationType: true,
      schoolLevel: true,
      graduationYear: true,
      degree: true,
      companyName: true,
      school: true,
      bio: true,
      skills: true,
      interests: true,
      profilePhoto: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(sanitizeUser(user));
}
```

- [ ] **Step 2: /api/profile/[id] — public profile view**

Create `app/api/profile/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await db.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      username: true,
      city: true,
      occupationType: true,
      schoolLevel: true,
      graduationYear: true,
      degree: true,
      companyName: true,
      school: true,
      bio: true,
      skills: true,
      interests: true,
      profilePhoto: true,
      contactEmail: true,
      contactEmailVisible: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...user,
    contactEmail: user.contactEmailVisible ? user.contactEmail : null,
  });
}
```

- [ ] **Step 3: /api/profile PATCH — update own profile**

Create `app/api/profile/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateProfileSchema } from "@/lib/validations";

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      username: true,
      city: true,
      bio: true,
      skills: true,
      interests: true,
      school: true,
      graduationYear: true,
      degree: true,
      contactEmail: true,
      contactEmailVisible: true,
    },
  });

  return NextResponse.json(updated);
}
```

- [ ] **Step 4: /api/profile/photo — upload profile photo**

Create `app/api/profile/photo/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("photo") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, and WebP images are allowed" },
      { status: 400 }
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Image must be under 5MB" },
      { status: 400 }
    );
  }

  // Delete old photo if it exists
  const existing = await db.user.findUnique({
    where: { id: session.user.id },
    select: { profilePhoto: true },
  });
  if (existing?.profilePhoto) {
    await del(existing.profilePhoto).catch(() => {});
  }

  const blob = await put(
    `profile-photos/${session.user.id}-${Date.now()}`,
    file,
    { access: "public" }
  );

  await db.user.update({
    where: { id: session.user.id },
    data: { profilePhoto: blob.url },
  });

  return NextResponse.json({ url: blob.url });
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/user/me app/api/profile
git commit -m "feat: add profile and user API routes"
```

---

## Task 14: Profile page + components

**Files:**
- Create: `components/profile/sidebar.tsx`
- Create: `components/profile/about-section.tsx`
- Create: `components/profile/education-section.tsx`
- Create: `components/profile/skills-section.tsx`
- Create: `components/profile/interests-section.tsx`
- Create: `components/profile/contact-section.tsx`
- Create: `app/profile/[id]/page.tsx`
- Create: `app/profile/edit/page.tsx`

- [ ] **Step 1: Profile sidebar component**

Create `components/profile/sidebar.tsx`:

```typescript
"use client";
import Image from "next/image";
import { useState, useRef } from "react";

interface SidebarProps {
  name: string | null;
  occupationType: string | null;
  companyName: string | null;
  city: string | null;
  profilePhoto: string | null;
  createdAt: string;
  isOwnProfile: boolean;
  onPhotoChange?: (url: string) => void;
}

function getOccupationBadge(occupationType: string | null, companyName: string | null): string {
  if (!occupationType) return "";
  if (occupationType === "STUDENT_HS") return "High School Student";
  if (occupationType === "STUDENT_COLLEGE") return "College Student";
  if (occupationType === "EMPLOYER")
    return companyName ? `Employer @ ${companyName}` : "Employer";
  return "Other";
}

export function ProfileSidebar({
  name,
  occupationType,
  companyName,
  city,
  profilePhoto,
  createdAt,
  isOwnProfile,
  onPhotoChange,
}: SidebarProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/profile/photo", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && onPhotoChange) onPhotoChange(data.url);
    } finally {
      setUploading(false);
    }
  }

  return (
    <aside className="flex flex-col items-center gap-4 w-full">
      <div className="relative">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-indigo-100 flex items-center justify-center">
          {profilePhoto ? (
            <Image src={profilePhoto} alt="Profile photo" fill className="object-cover" />
          ) : (
            <span className="text-3xl text-indigo-400">👤</span>
          )}
        </div>
        {isOwnProfile && (
          <>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 rounded-full bg-white border border-gray-200 p-1.5 shadow-sm hover:bg-gray-50 text-xs"
              aria-label="Change profile photo"
            >
              {uploading ? "..." : "✏️"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </>
        )}
      </div>
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-900">{name ?? "Anonymous"}</h1>
        {occupationType && (
          <span className="inline-block mt-1 rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-medium text-indigo-700">
            {getOccupationBadge(occupationType, companyName)}
          </span>
        )}
        {city && <p className="text-sm text-gray-500 mt-1">📍 {city}</p>}
        <p className="text-xs text-gray-400 mt-1">
          Member since {new Date(createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: About section**

Create `components/profile/about-section.tsx`:

```typescript
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface AboutSectionProps {
  bio: string | null;
  isOwnProfile: boolean;
  onSave?: (bio: string) => Promise<void>;
}

export function AboutSection({ bio, isOwnProfile, onSave }: AboutSectionProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(bio ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-gray-900">About</h2>
        {isOwnProfile && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 hover:underline">
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={300}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
          />
          <p className="text-xs text-gray-400 text-right">{value.length}/300</p>
          <div className="flex gap-2">
            <Button onClick={handleSave} isLoading={saving} className="text-sm px-4 py-2">Save</Button>
            <Button variant="ghost" onClick={() => { setEditing(false); setValue(bio ?? ""); }} className="text-sm">Cancel</Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          {bio ?? (isOwnProfile ? <span className="text-gray-400 italic">Add a short bio...</span> : <span className="text-gray-400">No bio yet.</span>)}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Education section**

Create `components/profile/education-section.tsx`:

```typescript
"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface EducationSectionProps {
  school: string | null;
  graduationYear: number | null;
  degree: string | null;
  isOwnProfile: boolean;
  onSave?: (data: { school: string; graduationYear: number; degree?: string }) => Promise<void>;
}

export function EducationSection({
  school,
  graduationYear,
  degree,
  isOwnProfile,
  onSave,
}: EducationSectionProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    school: school ?? "",
    graduationYear: graduationYear?.toString() ?? "",
    degree: degree ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({
        school: form.school,
        graduationYear: parseInt(form.graduationYear),
        degree: form.degree || undefined,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-gray-900">Education</h2>
        {isOwnProfile && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 hover:underline">Edit</button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-3">
          <Input label="School" value={form.school} onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))} />
          <Input label="Graduation year" type="number" value={form.graduationYear} onChange={(e) => setForm((f) => ({ ...f, graduationYear: e.target.value }))} />
          <Input label="Degree (optional)" value={form.degree} onChange={(e) => setForm((f) => ({ ...f, degree: e.target.value }))} />
          <div className="flex gap-2">
            <Button onClick={handleSave} isLoading={saving} className="text-sm px-4 py-2">Save</Button>
            <Button variant="ghost" onClick={() => setEditing(false)} className="text-sm">Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-600 flex flex-col gap-1">
          {school ? <p>🏫 {school}</p> : isOwnProfile && <p className="text-gray-400 italic">Add your school...</p>}
          {graduationYear && <p>🎓 Class of {graduationYear}</p>}
          {degree && <p>📚 {degree}</p>}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Skills section**

Create `components/profile/skills-section.tsx`:

```typescript
"use client";
import { useState } from "react";
import { TagInput } from "@/components/ui/tag-input";
import { Button } from "@/components/ui/button";

interface SkillsSectionProps {
  skills: string[];
  isOwnProfile: boolean;
  onSave?: (skills: string[]) => Promise<void>;
}

export function SkillsSection({ skills, isOwnProfile, onSave }: SkillsSectionProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(skills);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-gray-900">Skills</h2>
        {isOwnProfile && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 hover:underline">Edit</button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-3">
          <TagInput label="" tags={value} onChange={setValue} placeholder="Add a skill and press Enter" />
          <div className="flex gap-2">
            <Button onClick={handleSave} isLoading={saving} className="text-sm px-4 py-2">Save</Button>
            <Button variant="ghost" onClick={() => { setEditing(false); setValue(skills); }} className="text-sm">Cancel</Button>
          </div>
        </div>
      ) : skills.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {skills.map((s) => (
            <span key={s} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">{s}</span>
          ))}
        </div>
      ) : isOwnProfile ? (
        <p className="text-sm text-gray-400 italic">Add your skills...</p>
      ) : (
        <p className="text-sm text-gray-400">No skills listed.</p>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Interests section**

Create `components/profile/interests-section.tsx`:

```typescript
"use client";
import { useState } from "react";
import { TagInput } from "@/components/ui/tag-input";
import { Button } from "@/components/ui/button";

interface InterestsSectionProps {
  interests: string[];
  isOwnProfile: boolean;
  onSave?: (interests: string[]) => Promise<void>;
}

export function InterestsSection({ interests, isOwnProfile, onSave }: InterestsSectionProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(interests);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-gray-900">Interests</h2>
        {isOwnProfile && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 hover:underline">Edit</button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-3">
          <TagInput label="" tags={value} onChange={setValue} placeholder="Add an interest and press Enter" />
          <div className="flex gap-2">
            <Button onClick={handleSave} isLoading={saving} className="text-sm px-4 py-2">Save</Button>
            <Button variant="ghost" onClick={() => { setEditing(false); setValue(interests); }} className="text-sm">Cancel</Button>
          </div>
        </div>
      ) : interests.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {interests.map((i) => (
            <span key={i} className="rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700">{i}</span>
          ))}
        </div>
      ) : isOwnProfile ? (
        <p className="text-sm text-gray-400 italic">Add your interests...</p>
      ) : (
        <p className="text-sm text-gray-400">No interests listed.</p>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Contact section**

Create `components/profile/contact-section.tsx`:

```typescript
"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ContactSectionProps {
  contactEmail: string | null;
  contactEmailVisible: boolean;
  isOwnProfile: boolean;
  onSave?: (data: { contactEmail: string; contactEmailVisible: boolean }) => Promise<void>;
}

export function ContactSection({
  contactEmail,
  contactEmailVisible,
  isOwnProfile,
  onSave,
}: ContactSectionProps) {
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(contactEmail ?? "");
  const [visible, setVisible] = useState(contactEmailVisible);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({ contactEmail: email, contactEmailVisible: visible });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!isOwnProfile && !contactEmailVisible) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-gray-900">Contact</h2>
        {isOwnProfile && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 hover:underline">Edit</button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-3">
          <Input
            label="Contact email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@example.com"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={visible}
              onChange={(e) => setVisible(e.target.checked)}
              className="rounded"
            />
            Show email on my public profile
          </label>
          <div className="flex gap-2">
            <Button onClick={handleSave} isLoading={saving} className="text-sm px-4 py-2">Save</Button>
            <Button variant="ghost" onClick={() => setEditing(false)} className="text-sm">Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-600">
          {contactEmailVisible && contactEmail ? (
            <a href={`mailto:${contactEmail}`} className="text-indigo-600 hover:underline">
              {contactEmail}
            </a>
          ) : isOwnProfile ? (
            <p className="text-gray-400 italic">Add a contact email...</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 7: Public profile page**

Create `app/profile/[id]/page.tsx`:

```typescript
import { notFound } from "next/navigation";
import { ProfileSidebar } from "@/components/profile/sidebar";
import { AboutSection } from "@/components/profile/about-section";
import { EducationSection } from "@/components/profile/education-section";
import { SkillsSection } from "@/components/profile/skills-section";
import { InterestsSection } from "@/components/profile/interests-section";
import { ContactSection } from "@/components/profile/contact-section";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export default async function ProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  const user = await db.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      occupationType: true,
      companyName: true,
      city: true,
      profilePhoto: true,
      createdAt: true,
      bio: true,
      school: true,
      graduationYear: true,
      degree: true,
      skills: true,
      interests: true,
      contactEmail: true,
      contactEmailVisible: true,
    },
  });

  if (!user) notFound();

  const isOwnProfile = session?.user?.id === user.id;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto flex gap-8 flex-col md:flex-row">
        <div className="md:w-56 flex-shrink-0">
          <ProfileSidebar
            name={user.name}
            occupationType={user.occupationType}
            companyName={user.companyName}
            city={user.city}
            profilePhoto={user.profilePhoto}
            createdAt={user.createdAt.toISOString()}
            isOwnProfile={isOwnProfile}
          />
        </div>
        <div className="flex-1 flex flex-col gap-6 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <AboutSection bio={user.bio} isOwnProfile={false} />
          <hr className="border-gray-100" />
          <EducationSection
            school={user.school}
            graduationYear={user.graduationYear}
            degree={user.degree}
            isOwnProfile={false}
          />
          <hr className="border-gray-100" />
          <SkillsSection skills={user.skills} isOwnProfile={false} />
          <hr className="border-gray-100" />
          <InterestsSection interests={user.interests} isOwnProfile={false} />
          <hr className="border-gray-100" />
          <ContactSection
            contactEmail={user.contactEmail}
            contactEmailVisible={user.contactEmailVisible}
            isOwnProfile={false}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Profile edit page (own profile)**

Create `app/profile/edit/page.tsx`:

```typescript
"use client";
import { useEffect, useState } from "react";
import { ProfileSidebar } from "@/components/profile/sidebar";
import { AboutSection } from "@/components/profile/about-section";
import { EducationSection } from "@/components/profile/education-section";
import { SkillsSection } from "@/components/profile/skills-section";
import { InterestsSection } from "@/components/profile/interests-section";
import { ContactSection } from "@/components/profile/contact-section";

type ProfileData = {
  id: string;
  name: string | null;
  occupationType: string | null;
  companyName: string | null;
  city: string | null;
  profilePhoto: string | null;
  createdAt: string;
  bio: string | null;
  school: string | null;
  graduationYear: number | null;
  degree: string | null;
  skills: string[];
  interests: string[];
  contactEmail: string | null;
  contactEmailVisible: boolean;
};

async function patchProfile(data: Record<string, unknown>) {
  const res = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save");
}

export default function ProfileEditPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => r.json())
      .then(setProfile);
  }, []);

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto flex gap-8 flex-col md:flex-row">
        <div className="md:w-56 flex-shrink-0">
          <ProfileSidebar
            name={profile.name}
            occupationType={profile.occupationType}
            companyName={profile.companyName}
            city={profile.city}
            profilePhoto={profile.profilePhoto}
            createdAt={profile.createdAt}
            isOwnProfile={true}
            onPhotoChange={(url) => setProfile((p) => p ? { ...p, profilePhoto: url } : p)}
          />
        </div>
        <div className="flex-1 flex flex-col gap-6 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <AboutSection
            bio={profile.bio}
            isOwnProfile={true}
            onSave={async (bio) => {
              await patchProfile({ bio });
              setProfile((p) => p ? { ...p, bio } : p);
            }}
          />
          <hr className="border-gray-100" />
          <EducationSection
            school={profile.school}
            graduationYear={profile.graduationYear}
            degree={profile.degree}
            isOwnProfile={true}
            onSave={async (data) => {
              await patchProfile(data);
              setProfile((p) => p ? { ...p, ...data } : p);
            }}
          />
          <hr className="border-gray-100" />
          <SkillsSection
            skills={profile.skills}
            isOwnProfile={true}
            onSave={async (skills) => {
              await patchProfile({ skills });
              setProfile((p) => p ? { ...p, skills } : p);
            }}
          />
          <hr className="border-gray-100" />
          <InterestsSection
            interests={profile.interests}
            isOwnProfile={true}
            onSave={async (interests) => {
              await patchProfile({ interests });
              setProfile((p) => p ? { ...p, interests } : p);
            }}
          />
          <hr className="border-gray-100" />
          <ContactSection
            contactEmail={profile.contactEmail}
            contactEmailVisible={profile.contactEmailVisible}
            isOwnProfile={true}
            onSave={async (data) => {
              await patchProfile(data);
              setProfile((p) => p ? { ...p, ...data } : p);
            }}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Commit**

```bash
git add components/profile/ app/profile/
git commit -m "feat: add profile page and all profile section components"
```

---

## Task 15: Update root layout + landing page

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Update root layout metadata**

Replace `app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpportuniPath — Find your next opportunity",
  description:
    "The platform connecting students with jobs, internships, summer programs, and extracurricular opportunities.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Replace boilerplate landing page**

Replace `app/page.tsx`:

```typescript
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Find your next opportunity
      </h1>
      <p className="text-lg text-gray-500 max-w-md mb-8">
        OpportuniPath connects students with jobs, internships, summer programs,
        and extracurricular opportunities tailored to them.
      </p>
      <div className="flex gap-4">
        <Link
          href="/sign-up"
          className="rounded-full bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          Get started
        </Link>
        <Link
          href="/sign-in"
          className="rounded-full border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Run the app and verify it loads**

```bash
npm run dev
```

Open http://localhost:3000. Expected: landing page with "Find your next opportunity" heading and Get started / Sign in buttons.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat: update landing page and root layout metadata"
```

---

## Task 16: Final TypeScript check + deploy

- [ ] **Step 1: Run TypeScript compiler check**

```bash
npx tsc --noEmit
```

Fix any type errors before proceeding.

- [ ] **Step 2: Run linter**

```bash
npm run lint
```

Fix any lint errors.

- [ ] **Step 3: Build for production**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 4: Deploy to Vercel preview**

```bash
vercel
```

Expected: preview URL printed. Open it and verify the landing page loads.

- [ ] **Step 5: Verify environment variables are set in Vercel**

```bash
vercel env ls
```

Confirm all required keys are present: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_APPLE_ID`, `AUTH_APPLE_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

- [ ] **Step 6: Deploy to production**

```bash
vercel --prod
```

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "chore: production build verified and deployed"
```
