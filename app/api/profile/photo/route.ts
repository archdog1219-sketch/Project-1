import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUploadRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = await getUploadRateLimit().limit(session.user.id);
  if (!success) {
    return NextResponse.json({ error: "Too many uploads. Please try again later." }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("photo") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, and WebP images are allowed" },
      { status: 400 }
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Image must be under 5MB" },
      { status: 400 }
    );
  }

  const existing = await db.user.findUnique({
    where: { id: session.user.id },
    select: { profilePhoto: true },
  });
  if (existing?.profilePhoto) {
    await del(existing.profilePhoto).catch(() => {});
  }

  const blob = await put(
    `profile-photos/${session.user.id}-${Date.now()}`,
    file,
    { access: "public" }
  );

  await db.user.update({
    where: { id: session.user.id },
    data: { profilePhoto: blob.url },
  });

  return NextResponse.json({ url: blob.url });
}
