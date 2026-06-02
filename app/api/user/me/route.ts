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
      email: true,
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
      onboardingComplete: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(sanitizeUser(user as any));
}
