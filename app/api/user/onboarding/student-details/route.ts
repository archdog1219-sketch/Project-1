import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { OccupationType } from "@prisma/client";

const schema = z.object({
  schoolLevel: z.enum(["High School", "College"]),
  graduationYear: z.number().int().min(2020).max(2040),
  degree: z.string().max(200).optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { schoolLevel, graduationYear, degree } = parsed.data;
  const occupationType =
    schoolLevel === "High School"
      ? OccupationType.STUDENT_HS
      : OccupationType.STUDENT_COLLEGE;

  await db.user.update({
    where: { id: session.user.id },
    data: {
      occupationType,
      schoolLevel,
      graduationYear,
      degree: degree ?? null,
    },
  });

  return NextResponse.json({ success: true });
}
