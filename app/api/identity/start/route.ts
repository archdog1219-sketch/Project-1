import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getIdentityProvider, getVerification, isIdentityMockEnabled } from "@/lib/identity";
import { getWriteRateLimit } from "@/lib/rate-limit";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // No usable provider in production yet — don't open a session that can
  // never be completed (the mock's completion endpoint is refused there).
  if (getIdentityProvider().name === "mock" && !isIdentityMockEnabled()) {
    return NextResponse.json(
      { error: "Identity verification isn't available yet." },
      { status: 503 }
    );
  }
  const { success } = await getWriteRateLimit().limit(session.user.id);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }
  const existing = await getVerification(session.user.id);
  if (existing?.status === "VERIFIED") {
    return NextResponse.json({ error: "You're already verified." }, { status: 400 });
  }
  const { url } = await getIdentityProvider().createSession(session.user.id);
  return NextResponse.json({ url });
}
