import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { setPasswordSchema } from "@/lib/validations";
import { getRegistrationRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await getRegistrationRateLimit().limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = setPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { token, password } = parsed.data;

  const application = await db.companyApplication.findUnique({
    where: { setPasswordToken: token },
  });
  if (
    !application ||
    application.status !== "APPROVED" ||
    !application.setPasswordTokenExpires ||
    application.setPasswordTokenExpires < new Date()
  ) {
    return NextResponse.json({ error: "That link is invalid or has expired." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Clicking this emailed link proves control of the work address, so the
  // email is marked verified here rather than sending a second confirmation.
  await db.user.update({
    where: { email: application.workEmail },
    data: { passwordHash, emailVerified: new Date() },
  });

  // Single-use: clear the token so the link cannot be replayed.
  await db.companyApplication.update({
    where: { id: application.id },
    data: { setPasswordToken: null, setPasswordTokenExpires: null },
  });

  return NextResponse.json({ success: true });
}
