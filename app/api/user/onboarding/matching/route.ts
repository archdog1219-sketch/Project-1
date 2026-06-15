import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { matchingProfileSchema } from "@/lib/validations";
import { GpaRange } from "@prisma/client";

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = matchingProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { gpaRange, interests, extracurriculars } = parsed.data;
  await db.user.update({
    where: { id: session.user.id },
    data: {
      gpaRange: gpaRange as GpaRange,
      interests,
      extracurriculars: extracurriculars ?? [],
    },
  });

  return NextResponse.json({ success: true });
}
