import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import OpportunityForm, { type OpportunityFormValues } from "./opportunity-form";

export const dynamic = "force-dynamic";

export default async function PostPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/post");
  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { occupationType: true, companyName: true },
  });
  if (me?.occupationType !== "EMPLOYER") redirect("/");

  const initial: OpportunityFormValues = {
    title: "",
    org: me.companyName ?? "",
    type: "Internships",
    location: "",
    description: "",
    applyUrl: "",
    deadline: "",
    isPaid: false,
    targetGrades: [],
    targetInterests: [],
  };

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto", padding: "12px 16px", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ fontSize: "16px", fontWeight: "bold", color: "#3b5998", marginBottom: "10px" }}>Post an Opportunity</div>
      <OpportunityForm mode="create" initial={initial} />
    </div>
  );
}
