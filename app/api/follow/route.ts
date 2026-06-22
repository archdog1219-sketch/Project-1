import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { followSchema } from "@/lib/validations";
import { followUser, unfollowUser } from "@/lib/social";
import { getWriteRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = await getWriteRateLimit().limit(session.user.id);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = followSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (parsed.data.targetId === session.user.id) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  await followUser(session.user.id, parsed.data.targetId);
  return NextResponse.json({ following: true });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = await getWriteRateLimit().limit(session.user.id);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = followSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  await unfollowUser(session.user.id, parsed.data.targetId);
  return NextResponse.json({ following: false });
}
