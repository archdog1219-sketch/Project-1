import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAiDraftRateLimit } from "@/lib/rate-limit";
import { generateCoverLetter } from "@/lib/ai";
import { gradeLabelFor } from "@/lib/matching";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI drafts aren't configured yet." }, { status: 503 });
  }

  const { success } = await getAiDraftRateLimit().limit(session.user.id);
  if (!success) {
    return NextResponse.json({ error: "You've generated a lot of drafts recently. Try again later." }, { status: 429 });
  }

  const { id } = await params;
  const [user, opportunity] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, schoolLevel: true, graduationYear: true, occupationType: true, city: true, interests: true, extracurriculars: true, skills: true, bio: true },
    }),
    db.opportunity.findUnique({
      where: { id },
      select: { title: true, org: true, description: true },
    }),
  ]);

  if (!user || !opportunity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let content: string;
  try {
    content = await generateCoverLetter(
      {
        name: user.name,
        gradeLabel: gradeLabelFor(user),
        city: user.city,
        interests: user.interests,
        extracurriculars: user.extracurriculars,
        skills: user.skills,
        bio: user.bio,
      },
      { title: opportunity.title, org: opportunity.org, description: opportunity.description }
    );
  } catch {
    return NextResponse.json({ error: "Couldn't generate a draft right now. Please try again." }, { status: 502 });
  }

  if (!content) {
    return NextResponse.json({ error: "Couldn't generate a draft right now. Please try again." }, { status: 502 });
  }

  await db.aiDraft.upsert({
    where: { userId_opportunityId: { userId: session.user.id, opportunityId: id } },
    create: { userId: session.user.id, opportunityId: id, content },
    update: { content, generatedAt: new Date() },
  });

  return NextResponse.json({ content });
}
