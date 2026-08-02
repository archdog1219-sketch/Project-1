import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { setPasswordSchema } from "@/lib/validations";
import { getSetPasswordRateLimit } from "@/lib/rate-limit";

// Thrown inside the transaction when another request already claimed the
// token, so the rollback and the generic 400 share one code path.
class TokenAlreadyClaimed extends Error {}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await getSetPasswordRateLimit().limit(ip);
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

  try {
    await db.$transaction(async (tx) => {
      // Claiming inside the transaction means a failure below rolls the claim
      // back, so a transient fault can't spend the token without setting the
      // password. updateMany's WHERE on the token is what serializes two
      // concurrent redemptions — that is the single-use property.
      const claimed = await tx.companyApplication.updateMany({
        where: { id: application.id, setPasswordToken: token },
        data: { setPasswordToken: null, setPasswordTokenExpires: null },
      });
      if (claimed.count === 0) throw new TokenAlreadyClaimed();

      // Clicking this emailed link proves control of the work address, so the
      // email is marked verified here rather than sending a second confirmation.
      await tx.user.update({
        where: { email: application.workEmail },
        data: { passwordHash, emailVerified: new Date() },
      });
    });
  } catch (e) {
    if (e instanceof TokenAlreadyClaimed) {
      return NextResponse.json({ error: "That link is invalid or has expired." }, { status: 400 });
    }
    // Missing user row — same generic message, same reasoning.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "That link is invalid or has expired." }, { status: 400 });
    }
    // Anything else is a real failure and must surface as a 500, not
    // masquerade as a bad link.
    throw e;
  }

  return NextResponse.json({ success: true });
}
