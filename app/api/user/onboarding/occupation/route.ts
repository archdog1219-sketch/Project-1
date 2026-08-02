import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { OccupationType } from "@prisma/client";
import { getWriteRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  occupationType: z.enum(["STUDENT", "OTHER"]),
});

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = await getWriteRateLimit().limit(session.user.id);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { occupationType } = parsed.data;

  // EMPLOYER is deliberately not reachable here: company accounts are created
  // only by founder approval in /admin/companies.
  const dbOccupationType =
    occupationType === "STUDENT" ? OccupationType.STUDENT_HS : OccupationType.OTHER;

  await db.user.update({
    where: { id: session.user.id },
    data: { occupationType: dbOccupationType },
  });

  return NextResponse.json({ success: true });
}
