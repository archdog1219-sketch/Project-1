// Conceptual full set of save statuses. The persisted Prisma SaveStatus enum is
// currently the subset SAVED|APPLYING|APPLIED; ACCEPTED is included here ahead of
// the Phase 3 tracker (which will add it to the DB enum). feedEventTypeForStatus
// already handles ACCEPTED so no logic change is needed when that lands.
export type SaveStatus = "SAVED" | "APPLYING" | "APPLIED" | "ACCEPTED";
// Mirrors the Prisma FeedEventType enum (SAVED|APPLIED|ACCEPTED) so DB-layer code
// can use this union directly. Note: feedEventTypeForStatus never returns "SAVED"
// (saving is private) — it's here only to match the persisted enum.
export type FeedEventType = "SAVED" | "APPLIED" | "ACCEPTED";

// Which save statuses are publicly shareable as feed events. SAVED/APPLYING are private.
export function feedEventTypeForStatus(status: SaveStatus): FeedEventType | null {
  if (status === "APPLIED") return "APPLIED";
  if (status === "ACCEPTED") return "ACCEPTED";
  return null;
}

// Emit a feed event only when moving INTO a shareable status from a different status.
export function shouldEmitFeedEvent(prev: SaveStatus | null, next: SaveStatus): boolean {
  if (prev === next) return false;
  return feedEventTypeForStatus(next) !== null;
}

export interface SuggestionCandidate {
  id: string;
  name: string | null;
  interests: string[];
  verified: boolean;
}

// Rank candidate users by number of shared interests with `me`, descending.
// Excludes self, already-followed users, and anyone with zero overlap.
export function rankSuggestions(
  me: { id: string; interests: string[] },
  candidates: SuggestionCandidate[],
  alreadyFollowing: Set<string>
): (SuggestionCandidate & { shared: number })[] {
  const mine = new Set(me.interests.map((i) => i.toLowerCase()));
  return candidates
    .filter((c) => c.id !== me.id && !alreadyFollowing.has(c.id))
    .map((c) => ({
      ...c,
      shared: c.interests.filter((i) => mine.has(i.toLowerCase())).length,
    }))
    .filter((c) => c.shared > 0)
    .sort((a, b) => b.shared - a.shared);
}
