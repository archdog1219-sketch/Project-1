import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { signUpSchema } from "@/lib/validations";
import { sendVerificationEmail } from "@/lib/email";
import { getRegistrationRateLimit } from "@/lib/rate-limit";
import { generateOtpCode, normalizePhone, getPhoneOtpProvider, OTP_TTL_MS } from "@/lib/phone-otp";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await getRegistrationRateLimit().limit(ip);
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

  const { firstName, lastName, email, phone, password } = parsed.data;

  const existing = await db.user.findUnique({
    where: { email },
  });
  if (existing) {
    return NextResponse.json(
      { error: { email: ["An account with this email already exists"] } },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const otpCode = generateOtpCode();
  const normalizedPhone = normalizePhone(phone);

  await db.user.create({
    data: {
      email,
      passwordHash,
      name: `${firstName.trim()} ${lastName.trim()}`,
      hasEduEmail: email.toLowerCase().endsWith(".edu"),
      phone: normalizedPhone,
      phoneOtpCode: otpCode,
      phoneOtpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  await getPhoneOtpProvider().sendOtp(normalizedPhone, otpCode);

  const token = nanoid(32);
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.verificationToken.create({
    data: { identifier: email, token, expires },
  });

  await sendVerificationEmail(email, token);

  return NextResponse.json({ success: true }, { status: 201 });
}
