import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { OccupationType } from "@prisma/client";

const schema = z.object({
  occupationType: z.enum(["STUDENT", "EMPLOYER", "OTHER"]),
  companyName: z.string().max(200).optional(),
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

  const { occupationType, companyName } = parsed.data;

  const dbOccupationType =
    occupationType === "STUDENT"
      ? OccupationType.STUDENT_HS
      : occupationType === "EMPLOYER"
      ? OccupationType.EMPLOYER
      : OccupationType.OTHER;

  await db.user.update({
    where: { id: session.user.id },
    data: {
      occupationType: dbOccupationType,
      companyName: companyName ?? null,
    },
  });

  return NextResponse.json({ success: true });
}
