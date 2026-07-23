import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { identityMockSchema } from "@/lib/validations";
import { namesMatch, getVerification, recordVerificationResult, getIdentityProvider } from "@/lib/identity";
import { getWriteRateLimit } from "@/lib/rate-limit";

// Mock-only endpoint: a real vendor reports results via webhook instead.
export async function POST(request: NextRequest) {
  if (getIdentityProvider().name !== "mock") {
    return NextResponse.json({ error: "Mock completion is disabled." }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { success } = await getWriteRateLimit().limit(session.user.id);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }
  const pending = await getVerification(session.user.id);
  if (!pending || pending.status === "VERIFIED") {
    return NextResponse.json({ error: "No verification in progress." }, { status: 400 });
  }
  const body = await request.json();
  const parsed = identityMockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const me = await db.user.findUnique({ where: { id: session.user.id }, select: { name: true } });
  const legalName = `${parsed.data.legalFirstName} ${parsed.data.legalLastName}`;
  const nameMatched = namesMatch(me?.name ?? null, legalName);
  const passed = parsed.data.outcome === "pass";
  const verified = await recordVerificationResult(session.user.id, {
    passed,
    nameMatched,
    issuingCountry: parsed.data.issuingCountry,
    failureReason: !passed
      ? "Simulated document/liveness failure"
      : !nameMatched
        ? "The name on your ID doesn't match your profile name."
        : undefined,
  });
  return NextResponse.json({ verified });
}
