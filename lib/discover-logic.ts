import type { OpportunityView } from "./opportunities";
import { rankForUser, type MatchProfile, type ScoredOpportunity } from "./matching";

export const DEFAULT_DECK_SIZE = 20;

// Composes the Discover deck: drops opportunities the user has already acted on
// (saved at any status, or skipped), ranks the rest by profile match, caps the size.
export function buildDeck(
  profile: MatchProfile,
  opportunities: OpportunityView[],
  excludedIds: ReadonlySet<string>,
  limit: number = DEFAULT_DECK_SIZE
): ScoredOpportunity[] {
  const candidates = opportunities.filter((o) => !excludedIds.has(o.id));
  return rankForUser(profile, candidates).slice(0, limit);
}
