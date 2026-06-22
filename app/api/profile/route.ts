import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateProfileSchema } from "@/lib/validations";
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
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      username: true,
      city: true,
      bio: true,
      skills: true,
      interests: true,
      school: true,
      graduationYear: true,
      degree: true,
      contactEmail: true,
      contactEmailVisible: true,
    },
  });

  return NextResponse.json(updated);
}
