import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ENUM_TO_LABEL } from "@/lib/listings";
import OpportunityForm, { type OpportunityFormValues } from "../../opportunity-form";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/my-postings");
  const me = await db.user.findUnique({ where: { id: session.user.id }, select: { occupationType: true } });
  if (me?.occupationType !== "EMPLOYER") redirect("/");

  const { id } = await params;
  const o = await db.opportunity.findUnique({ where: { id } });
  if (!o) notFound();
  if (o.ownerId !== session.user.id) redirect("/my-postings");

  const initial: OpportunityFormValues = {
    title: o.title,
    org: o.org,
    type: ENUM_TO_LABEL[o.type],
    location: o.location,
    description: o.description,
    applyUrl: o.applyUrl ?? "",
    deadline: o.deadline ?? "",
    isPaid: o.isPaid,
    targetGrades: o.targetGrades,
    targetInterests: o.targetInterests,
  };

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto", padding: "12px 16px", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ fontSize: "16px", fontWeight: "bold", color: "#3b5998", marginBottom: "10px" }}>Edit Posting</div>
      <OpportunityForm mode="edit" opportunityId={o.id} initial={initial} />
    </div>
  );
}
