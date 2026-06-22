import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { opportunitySubmissionSchema } from "@/lib/validations";
import { validateSubmission } from "@/lib/moderation";
import { getWriteRateLimit, getPostRateLimit } from "@/lib/rate-limit";
import { LABEL_TO_ENUM } from "@/lib/listings";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { occupationType: true, companyName: true },
  });
  if (me?.occupationType !== "EMPLOYER") {
    return NextResponse.json({ error: "Only employer accounts can post opportunities." }, { status: 403 });
  }

  const write = await getWriteRateLimit().limit(session.user.id);
  if (!write.success) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }
  const post = await getPostRateLimit().limit(session.user.id);
  if (!post.success) {
    return NextResponse.json({ error: "You've reached the daily limit for new postings." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = opportunitySubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const data = parsed.data;

  const gate = validateSubmission({ title: data.title, description: data.description });
  if (!gate.ok) {
    return NextResponse.json({ error: gate.reason }, { status: 400 });
  }

  const dup = await db.opportunity.findFirst({
    where: {
      ownerId: session.user.id,
      title: { equals: data.title, mode: "insensitive" },
      org: { equals: data.org, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (dup) {
    return NextResponse.json({ error: "You already have a posting with this title and organization." }, { status: 400 });
  }

  const created = await db.opportunity.create({
    data: {
      title: data.title,
      org: data.org,
      type: LABEL_TO_ENUM[data.type],
      location: data.location,
      description: data.description,
      tags: [],
      deadline: data.deadline ? data.deadline : null,
      applyUrl: data.applyUrl ? data.applyUrl : null,
      targetGrades: data.targetGrades,
      targetInterests: data.targetInterests,
      isPaid: data.isPaid,
      ownerId: session.user.id,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: created.id });
}
