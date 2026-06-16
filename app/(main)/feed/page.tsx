import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getFeed, getFollowSuggestions } from "@/lib/social";
import SuggestionsRail from "./feed-client";

export const dynamic = "force-dynamic";

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const VERB: Record<string, string> = {
  SAVED: "saved",
  APPLIED: "applied to",
  ACCEPTED: "was accepted to",
};

export default async function FeedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/feed");

  const [feed, suggestions] = await Promise.all([
    getFeed(session.user.id),
    getFollowSuggestions(session.user.id),
  ]);

  const s = {
    panel: { background: "#e8edf5", border: "1px solid #c8d0e0", borderRadius: "3px", overflow: "hidden" as const },
    panelHead: { background: "#3b5998", color: "#fff", padding: "6px 12px", fontSize: "11px", fontWeight: "bold" as const },
  };

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif", maxWidth: "960px", margin: "0 auto", padding: "12px 16px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: "bold", color: "#3b5998", marginBottom: "8px" }}>Recent Activity</div>
        {feed.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#666", border: "1px solid #c8d0e0", borderRadius: "3px", background: "#fff", padding: "16px" }}>
            Your feed is empty. Follow some students (see suggestions →) and their activity will show up here.
          </div>
        ) : (
          feed.map((e) => (
            <div key={e.id} style={{ display: "flex", gap: "8px", padding: "8px 10px", border: "1px solid #c8d0e0", borderRadius: "3px", background: "#fff", marginBottom: "5px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#3b5998", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "bold", flexShrink: 0 }}>
                {(e.actorName ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <div style={{ fontSize: "12px", lineHeight: 1.5 }}>
                <Link href={`/profile/${e.actorId}`} style={{ color: "#3b5998", fontWeight: "bold", textDecoration: "none" }}>{e.actorName ?? "A student"}</Link>
                {" "}{VERB[e.type] ?? "updated"}{" "}
                <Link href={`/opportunities/${e.opportunityId}`} style={{ color: "#3b5998", fontWeight: "bold", textDecoration: "none" }}>{e.opportunityTitle}</Link>
                {" "}at {e.opportunityOrg}
                <div style={{ color: "#999", fontSize: "10px" }}>{timeAgo(e.createdAt)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <aside style={{ width: "220px", flexShrink: 0 }}>
        <div style={s.panel}>
          <div style={s.panelHead}>Students with similar interests</div>
          <div style={{ padding: "8px 12px", background: "#fff" }}>
            <SuggestionsRail initial={suggestions} />
          </div>
        </div>
      </aside>
    </div>
  );
}
