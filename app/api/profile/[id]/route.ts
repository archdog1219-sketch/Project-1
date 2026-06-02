import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
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
