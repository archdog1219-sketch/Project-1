import { db } from "@/lib/db";
import { IdvStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Identity-verification provider seam.
// Shaped like Stripe Identity's session flow (create session → user completes
// → result recorded) so a real vendor can replace the mock by implementing
// IdentityProvider and switching IDV_PROVIDER — nothing else changes.
// Only a verification RECORD is ever stored: no ID images, no document numbers.
// ---------------------------------------------------------------------------

export interface IdentityProvider {
  name: string;
  /** Begin (or restart) verification; returns the URL the user should visit. */
  createSession(userId: string): Promise<{ url: string }>;
}

/** Case/whitespace-insensitive full-name comparison — the check that makes
 * "real name" real. Enforced identically by the mock and future vendors. */
export function namesMatch(profileName: string | null, legalName: string): boolean {
  if (!profileName || !legalName) return false;
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const a = norm(profileName);
  const b = norm(legalName);
  return a.length > 0 && a === b;
}

const mockProvider: IdentityProvider = {
  name: "mock",
  async createSession(userId: string) {
    await db.identityVerification.upsert({
      where: { userId },
      create: { userId, provider: "mock", status: IdvStatus.PENDING },
      update: { provider: "mock", status: IdvStatus.PENDING, failureReason: null },
    });
    return { url: "/verify/mock" };
  },
};

export function getIdentityProvider(): IdentityProvider {
  // IDV_PROVIDER=stripe_identity will select the real vendor once implemented.
  return mockProvider;
}

export async function getVerification(userId: string) {
  return db.identityVerification.findUnique({ where: { userId } });
}

/** Records a completed check. Sets the denormalized User.idVerified flag. */
export async function recordVerificationResult(
  userId: string,
  result: { passed: boolean; nameMatched: boolean; issuingCountry?: string; failureReason?: string }
) {
  const verified = result.passed && result.nameMatched;
  await db.identityVerification.update({
    where: { userId },
    data: {
      status: verified ? IdvStatus.VERIFIED : IdvStatus.FAILED,
      nameMatched: result.nameMatched,
      issuingCountry: result.issuingCountry ?? null,
      failureReason: verified ? null : result.failureReason ?? "Verification failed",
      verifiedAt: verified ? new Date() : null,
    },
  });
  await db.user.update({ where: { id: userId }, data: { idVerified: verified } });
  return verified;
}
