import { db } from "@/lib/db";
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
}

function toView(o: {
  id: string; title: string; org: string; type: keyof typeof ENUM_TO_LABEL;
  location: string; description: string; tags: string[]; deadline: string | null;
  applyUrl: string | null; targetGrades: string[]; targetInterests: string[]; isPaid: boolean;
}): OpportunityView {
  return { ...o, type: ENUM_TO_LABEL[o.type] };
}

export async function getAllOpportunities(): Promise<OpportunityView[]> {
  const rows = await db.opportunity.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(toView);
}

export async function getOpportunityById(id: string): Promise<OpportunityView | null> {
  const row = await db.opportunity.findUnique({ where: { id } });
  return row ? toView(row) : null;
}
