import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { getWriteRateLimit } from "@/lib/rate-limit";
import { sendCompanyApprovedEmail, sendCompanyRejectedEmail } from "@/lib/email";
import { OccupationType } from "@prisma/client";

const schema = z.object({ action: z.enum(["approve", "reject"]) });

const SET_PASSWORD_TTL_MS = 24 * 60 * 60 * 1000;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  const { success } = await getWriteRateLimit().limit(session!.user!.id!);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const application = await db.companyApplication.findUnique({ where: { id } });
  if (!application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }
  if (application.status !== "PENDING") {
    return NextResponse.json({ error: "This application has already been decided." }, { status: 400 });
  }

  if (parsed.data.action === "reject") {
    await db.companyApplication.update({
      where: { id },
      data: { status: "REJECTED", decidedAt: new Date() },
    });
    await sendCompanyRejectedEmail(application.workEmail, application.companyName);
    return NextResponse.json({ success: true });
  }

  // Approve: guard against an account appearing between submission and review.
  const existingUser = await db.user.findUnique({ where: { email: application.workEmail } });
  if (existingUser) {
    return NextResponse.json(
      { error: "An account already exists with this email." },
      { status: 409 }
    );
  }

  // phoneVerified is true because the founder's manual review IS this account's
  // trust gate — company accounts never go through phone OTP. emailVerified
  // stays null until they click the set-password link, which proves the address.
  await db.user.create({
    data: {
      email: application.workEmail,
      name: application.contactName,
      companyName: application.companyName,
      occupationType: OccupationType.EMPLOYER,
      phoneVerified: true,
    },
  });

  const token = nanoid(32);
  await db.companyApplication.update({
    where: { id },
    data: {
      status: "APPROVED",
      decidedAt: new Date(),
      setPasswordToken: token,
      setPasswordTokenExpires: new Date(Date.now() + SET_PASSWORD_TTL_MS),
    },
  });

  await sendCompanyApprovedEmail(
    application.workEmail,
    `${process.env.NEXTAUTH_URL}/company/set-password?token=${token}`
  );

  return NextResponse.json({ success: true });
}
