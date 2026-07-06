import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { swipeSchema } from "@/lib/validations";
import { setSaveStatus } from "@/lib/social";
import { recordSkip } from "@/lib/discover";
import { getSwipeRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = await getSwipeRateLimit().limit(session.user.id);
  if (!success) {
    return NextResponse.json({ error: "Whoa — you're swiping fast. Give it a minute." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = swipeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { id } = await params;
  const opportunity = await db.opportunity.findUnique({ where: { id }, select: { id: true } });
  if (!opportunity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.direction === "save") {
    await setSaveStatus(session.user.id, id, "SAVED");
  } else {
    await recordSkip(session.user.id, id);
  }

  return NextResponse.json({ result: parsed.data.direction });
}
