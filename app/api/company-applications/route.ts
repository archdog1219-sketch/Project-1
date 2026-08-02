import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companyApplicationSchema } from "@/lib/validations";
import { sendCompanyApplicationNotification } from "@/lib/email";
import { getCompanyApplicationRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await getCompanyApplicationRateLimit().limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = companyApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { companyName, contactName, workEmail, website, description } = parsed.data;

  const existingUser = await db.user.findUnique({ where: { email: workEmail } });
  if (existingUser) {
    return NextResponse.json(
      { error: { workEmail: ["An account already exists with this email."] } },
      { status: 409 }
    );
  }

  const existingApplication = await db.companyApplication.findFirst({
    where: { workEmail, status: { in: ["PENDING", "APPROVED"] } },
  });
  if (existingApplication) {
    return NextResponse.json(
      { error: { workEmail: ["You already have an application on file."] } },
      { status: 409 }
    );
  }

  const application = await db.companyApplication.create({
    data: {
      companyName,
      contactName,
      workEmail,
      website: website || null,
      description: description || null,
    },
  });

  // The founder allow-list doubles as the notification list. A missing
  // ADMIN_EMAILS must not lose the application — it is already saved above.
  const adminEmail = (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim();
  if (!adminEmail) {
    console.error(
      "ADMIN_EMAILS is not set — company application saved but no notification sent."
    );
  }
  if (adminEmail) {
    await sendCompanyApplicationNotification(adminEmail, application);
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
