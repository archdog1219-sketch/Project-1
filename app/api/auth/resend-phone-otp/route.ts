import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resendPhoneOtpSchema } from "@/lib/validations";
import { generateOtpCode, getPhoneOtpProvider, OTP_TTL_MS } from "@/lib/phone-otp";
import { getPhoneOtpRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = resendPhoneOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { email } = parsed.data;

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const ipLimit = await getPhoneOtpRateLimit().limit(`resend-ip:${ip}`);
  if (!ipLimit.success) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const { success } = await getPhoneOtpRateLimit().limit(`resend:${email.toLowerCase()}`);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, phone: true, phoneVerified: true },
  });

  // Always report success: a differing response would reveal which emails exist.
  if (user && user.phone && !user.phoneVerified) {
    const otpCode = generateOtpCode();
    await db.user.update({
      where: { id: user.id },
      data: { phoneOtpCode: otpCode, phoneOtpExpiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });
    await getPhoneOtpProvider().sendOtp(user.phone, otpCode);
  }

  return NextResponse.json({ success: true });
}
