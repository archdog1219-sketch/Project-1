import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { basicInfoSchema } from "@/lib/validations";
import { isOldEnough } from "@/lib/auth-utils";
import { getWriteRateLimit } from "@/lib/rate-limit";

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
  const parsed = basicInfoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const dob = new Date(parsed.data.dateOfBirth);
  if (!isOldEnough(dob)) {
    return NextResponse.json(
      { error: "You must be at least 16 years old to use this platform." },
      { status: 403 }
    );
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      name: parsed.data.name,
      dateOfBirth: dob,
      city: parsed.data.city,
    },
  });

  return NextResponse.json({ success: true });
}
