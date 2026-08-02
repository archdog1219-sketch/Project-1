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

  // Claim the token atomically BEFORE doing any writes. updateMany's WHERE
  // still matches the token, so a second concurrent request whose validity
  // check already passed will match zero rows and bail out here — that is
  // what makes the link genuinely single-use.
  const claimed = await db.companyApplication.updateMany({
    where: { id: application.id, setPasswordToken: token },
    data: { setPasswordToken: null, setPasswordTokenExpires: null },
  });
  if (claimed.count === 0) {
    return NextResponse.json({ error: "That link is invalid or has expired." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Clicking this emailed link proves control of the work address, so the
  // email is marked verified here rather than sending a second confirmation.
  try {
    await db.user.update({
      where: { email: application.workEmail },
      data: { passwordHash, emailVerified: new Date() },
    });
  } catch {
    // The User row is missing (e.g. manually deleted between approval and
    // the click). The token is already spent above, so the applicant needs
    // a fresh approval — do not leak that detail in the response.
    return NextResponse.json({ error: "That link is invalid or has expired." }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
