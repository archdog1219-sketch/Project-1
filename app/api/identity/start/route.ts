import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getIdentityProvider, getVerification } from "@/lib/identity";
import { getWriteRateLimit } from "@/lib/rate-limit";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
