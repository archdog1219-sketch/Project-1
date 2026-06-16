import { db } from "@/lib/db";
import { FeedEventType, SaveStatus } from "@prisma/client";
import { feedEventTypeForStatus, shouldEmitFeedEvent, rankSuggestions } from "@/lib/feed-logic";

// --- Saving / applying ---

export async function getSaveStatus(userId: string, opportunityId: string): Promise<SaveStatus | null> {
  const row = await db.savedOpportunity.findUnique({
    where: { userId_opportunityId: { userId, opportunityId } },
    select: { status: true },
  });
  return row?.status ?? null;
}

// Upserts the user's save status for an opportunity, emitting a FeedEvent when
// the transition is into a shareable status (APPLIED/ACCEPTED). Returns the new status.
export async function setSaveStatus(
  userId: string,
  opportunityId: string,
  status: SaveStatus
): Promise<SaveStatus> {
  const prev = await getSaveStatus(userId, opportunityId);

  await db.savedOpportunity.upsert({
    where: { userId_opportunityId: { userId, opportunityId } },
    create: { userId, opportunityId, status },
    update: { status },
  });

  if (shouldEmitFeedEvent(prev, status)) {
    const type = feedEventTypeForStatus(status);
    if (type) {
      await db.feedEvent.create({
        data: { actorId: userId, opportunityId, type: type as FeedEventType },
      });
    }
  }

  return status;
}

// --- Following ---

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const row = await db.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
    select: { id: true },
  });
  return row !== null;
}

export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) return;
  await db.follow.upsert({
    where: { followerId_followingId: { followerId, followingId } },
    create: { followerId, followingId },
    update: {},
  });
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  await db.follow.deleteMany({ where: { followerId, followingId } });
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    db.follow.count({ where: { followingId: userId } }),
    db.follow.count({ where: { followerId: userId } }),
  ]);
  return { followers, following };
}

// --- Feed ---

export interface FeedItem {
  id: string;
  type: FeedEventType;
  createdAt: Date;
  actorId: string;
  actorName: string | null;
  opportunityId: string;
  opportunityTitle: string;
  opportunityOrg: string;
}

export async function getFeed(userId: string, limit = 50): Promise<FeedItem[]> {
  const following = await db.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  const actorIds = following.map((f) => f.followingId);
  if (actorIds.length === 0) return [];

  const events = await db.feedEvent.findMany({
    where: { actorId: { in: actorIds } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: { select: { id: true, name: true } },
      opportunity: { select: { id: true, title: true, org: true } },
    },
  });

  return events.map((e) => ({
    id: e.id,
    type: e.type,
    createdAt: e.createdAt,
    actorId: e.actor.id,
    actorName: e.actor.name,
    opportunityId: e.opportunity.id,
    opportunityTitle: e.opportunity.title,
    opportunityOrg: e.opportunity.org,
  }));
}

// --- Suggestions ("people like you") ---

export interface Suggestion {
  id: string;
  name: string | null;
  shared: number;
}

export async function getFollowSuggestions(userId: string, limit = 5): Promise<Suggestion[]> {
  const me = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, interests: true },
  });
  if (!me || me.interests.length === 0) return [];

  // Candidate pool: users sharing at least one interest (DB-level prefilter), capped.
  const candidates = await db.user.findMany({
    where: {
      id: { not: userId },
      interests: { hasSome: me.interests },
    },
    select: { id: true, name: true, interests: true },
    take: 50,
  });

  const following = await db.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  const alreadyFollowing = new Set(following.map((f) => f.followingId));

  return rankSuggestions({ id: me.id, interests: me.interests }, candidates, alreadyFollowing)
    .slice(0, limit)
    .map((c) => ({ id: c.id, name: c.name, shared: c.shared }));
}
