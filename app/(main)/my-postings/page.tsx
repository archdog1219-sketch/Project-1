import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOwnedOpportunities } from "@/lib/opportunities";
import { TYPE_LABELS } from "@/lib/listings";
import DeleteButton from "./delete-button";

export const dynamic = "force-dynamic";

export default async function MyPostingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/my-postings");
  const me = await db.user.findUnique({ where: { id: session.user.id }, select: { occupationType: true } });
  if (me?.occupationType !== "EMPLOYER") redirect("/");

  const items = await getOwnedOpportunities(session.user.id);

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "12px 16px", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <div style={{ fontSize: "16px", fontWeight: "bold", color: "#3b5998" }}>My Postings</div>
        <Link href="/post" style={{ background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "4px 10px", fontSize: "12px", fontWeight: "bold", borderRadius: "2px", textDecoration: "none" }}>+ Post new</Link>
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize: "12px", color: "#666", border: "1px solid #c8d0e0", borderRadius: "3px", background: "#fff", padding: "16px" }}>
          You haven&apos;t posted anything yet. <Link href="/post" style={{ color: "#3b5998" }}>Post your first opportunity</Link>.
        </div>
      ) : (
        items.map((o) => (
          <div key={o.id} style={{ border: "1px solid #c8d0e0", borderRadius: "3px", background: "#fff", padding: "9px 12px", marginBottom: "5px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
              <div style={{ minWidth: 0 }}>
                <Link href={`/opportunities/${o.id}`} style={{ color: "#3b5998", fontWeight: "bold", fontSize: "13px", textDecoration: "none" }}>{o.title}</Link>
                <div style={{ fontSize: "11px", color: "#666" }}>{o.org} · {o.location} · {TYPE_LABELS[o.type]}</div>
              </div>
              <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                <Link href={`/post/${o.id}/edit`} style={{ background: "#e8edf5", color: "#3b5998", border: "1px solid #c8d0e0", padding: "2px 8px", fontSize: "10px", borderRadius: "2px", textDecoration: "none" }}>Edit</Link>
                <DeleteButton opportunityId={o.id} />
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
