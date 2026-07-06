import { db } from "@/lib/db";
import { getAllOpportunities } from "@/lib/opportunities";
import { gradeLabelFor, type MatchProfile, type ScoredOpportunity } from "@/lib/matching";
import { buildDeck, DEFAULT_DECK_SIZE } from "@/lib/discover-logic";

export interface SwipeDeckResult {
  deck: ScoredOpportunity[];
  hasMatchingProfile: boolean;
}

export async function getSwipeDeck(userId: string, limit = DEFAULT_DECK_SIZE): Promise<SwipeDeckResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { schoolLevel: true, graduationYear: true, city: true, interests: true, occupationType: true },
  });
  if (!user) return { deck: [], hasMatchingProfile: false };

  const profile: MatchProfile = {
    gradeLabel: gradeLabelFor(user),
    location: user.city ?? null,
    interests: user.interests ?? [],
  };

  const [all, saved, skipped] = await Promise.all([
    getAllOpportunities(),
    db.savedOpportunity.findMany({ where: { userId }, select: { opportunityId: true } }),
    db.opportunitySkip.findMany({ where: { userId }, select: { opportunityId: true } }),
  ]);

  const excluded = new Set<string>([
    ...saved.map((s) => s.opportunityId),
    ...skipped.map((s) => s.opportunityId),
  ]);

  return {
    deck: buildDeck(profile, all, excluded, limit),
    hasMatchingProfile: profile.interests.length > 0,
  };
}

// Idempotent: re-skipping the same opportunity is a no-op.
export async function recordSkip(userId: string, opportunityId: string): Promise<void> {
  await db.opportunitySkip.upsert({
    where: { userId_opportunityId: { userId, opportunityId } },
    create: { userId, opportunityId },
    update: {},
  });
}
