import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ENUM_TO_LABEL, type OpportunityTypeLabel } from "@/lib/listings";

export interface OpportunityView {
  id: string;
  title: string;
  org: string;
  type: OpportunityTypeLabel;
  location: string;
  description: string;
  tags: string[];
  deadline: string | null;
  applyUrl: string | null;
  targetGrades: string[];
  targetInterests: string[];
  isPaid: boolean;
  ownerVerified: boolean;
}

function toView(
  o: Prisma.OpportunityGetPayload<{ include: { owner: { select: { idVerified: true } } } }>
): OpportunityView {
  return {
    id: o.id,
    title: o.title,
    org: o.org,
    type: ENUM_TO_LABEL[o.type],
    location: o.location,
    description: o.description,
    tags: o.tags,
    deadline: o.deadline,
    applyUrl: o.applyUrl,
    targetGrades: o.targetGrades,
    targetInterests: o.targetInterests,
    isPaid: o.isPaid,
    ownerVerified: o.owner?.idVerified ?? false,
  };
}

const OWNER_INCLUDE = { owner: { select: { idVerified: true } } } as const;

export async function getAllOpportunities(): Promise<OpportunityView[]> {
  const rows = await db.opportunity.findMany({
    orderBy: { createdAt: "asc" },
    include: OWNER_INCLUDE,
  });
  return rows.map(toView);
}

export async function getOpportunityById(id: string): Promise<OpportunityView | null> {
  const row = await db.opportunity.findUnique({ where: { id }, include: OWNER_INCLUDE });
  return row ? toView(row) : null;
}

export async function getOwnedOpportunities(userId: string): Promise<OpportunityView[]> {
  const rows = await db.opportunity.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    include: OWNER_INCLUDE,
  });
  return rows.map(toView);
}
