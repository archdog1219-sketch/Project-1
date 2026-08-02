import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPhoneSchema } from "@/lib/validations";
import { isOtpValid } from "@/lib/phone-otp";
import { getPhoneOtpRateLimit } from "@/lib/rate-limit";

// Unauthenticated by necessity: the user cannot sign in until this succeeds.
// The 6-digit code is the secret; the rate limiter is what makes it safe.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = verifyPhoneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { email, code } = parsed.data;

  const { success } = await getPhoneOtpRateLimit().limit(email.toLowerCase());
  if (!success) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, phoneVerified: true, phoneOtpCode: true, phoneOtpExpiresAt: true },
  });

  // Same generic error for "no such user" and "wrong code" so this endpoint
  // cannot be used to enumerate which email addresses have accounts.
  if (!user || !isOtpValid({ code: user.phoneOtpCode, expiresAt: user.phoneOtpExpiresAt }, code)) {
    return NextResponse.json({ error: "That code is incorrect or has expired." }, { status: 400 });
  }

  await db.user.update({
    where: { id: user.id },
    data: { phoneVerified: true, phoneOtpCode: null, phoneOtpExpiresAt: null },
  });

  return NextResponse.json({ success: true });
}
