import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { opportunitySubmissionSchema } from "@/lib/validations";
import { validateSubmission } from "@/lib/moderation";
import { getWriteRateLimit } from "@/lib/rate-limit";
import { LABEL_TO_ENUM } from "@/lib/listings";

async function loadOwned(userId: string, id: string) {
  const opp = await db.opportunity.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  if (!opp) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (opp.ownerId !== userId) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { ok: true as const };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const owned = await loadOwned(session.user.id, id);
  if ("error" in owned) return owned.error;

  const { success } = await getWriteRateLimit().limit(session.user.id);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
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
      id: { not: id },
      title: { equals: data.title, mode: "insensitive" },
      org: { equals: data.org, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (dup) {
    return NextResponse.json({ error: "You already have another posting with this title and organization." }, { status: 400 });
  }

  await db.opportunity.update({
    where: { id },
    data: {
      title: data.title,
      org: data.org,
      type: LABEL_TO_ENUM[data.type],
      location: data.location,
      description: data.description,
      deadline: data.deadline ? data.deadline : null,
      applyUrl: data.applyUrl ? data.applyUrl : null,
      targetGrades: data.targetGrades,
      targetInterests: data.targetInterests,
      isPaid: data.isPaid,
    },
  });

  return NextResponse.json({ id });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const owned = await loadOwned(session.user.id, id);
  if ("error" in owned) return owned.error;

  await db.opportunity.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
