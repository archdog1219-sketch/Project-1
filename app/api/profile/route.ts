import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateProfileSchema } from "@/lib/validations";
import { getWriteRateLimit } from "@/lib/rate-limit";
import { namesMatch } from "@/lib/identity";

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

  // The Verified badge asserts the profile name matches a checked ID. If a
  // verified user changes their name to something that no longer matches,
  // verification is revoked (LinkedIn-style) and they must re-verify.
  let revokeVerification = false;
  if (parsed.data.name !== undefined) {
    const current = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, idVerified: true },
    });
    if (current?.idVerified && !namesMatch(current.name, parsed.data.name)) {
      revokeVerification = true;
    }
  }

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: { ...parsed.data, ...(revokeVerification ? { idVerified: false } : {}) },
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

  if (revokeVerification) {
    await db.identityVerification.updateMany({
      where: { userId: session.user.id },
      data: {
        status: "FAILED",
        nameMatched: false,
        verifiedAt: null,
        failureReason:
          "Profile name changed after verification — verify again to restore your badge.",
      },
    });
  }

  return NextResponse.json(updated);
}
