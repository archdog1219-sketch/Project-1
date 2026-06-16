import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTrackedOpportunities } from "@/lib/social";
import { groupByStatus, deadlineInfo, STATUS_LANES, LANE_LABELS } from "@/lib/tracker-logic";
import TrackerCard from "./tracker-card";

export const dynamic = "force-dynamic";

export default async function TrackerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/tracker");

  const items = await getTrackedOpportunities(session.user.id);
  const grouped = groupByStatus(items);

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif", maxWidth: "720px", margin: "0 auto", padding: "12px 16px" }}>
      <div style={{ fontSize: "13px", fontWeight: "bold", color: "#3b5998", marginBottom: "10px" }}>My Tracker</div>

      {items.length === 0 ? (
        <div style={{ fontSize: "12px", color: "#666", border: "1px solid #c8d0e0", borderRadius: "3px", background: "#fff", padding: "16px" }}>
          You haven&apos;t saved anything yet. Browse opportunities and hit <b>Save</b> or <b>Mark as applied</b> to track them here.
        </div>
      ) : (
        STATUS_LANES.map((lane) => (
          <div key={lane} style={{ marginBottom: "14px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "5px" }}>
              {LANE_LABELS[lane]} ({grouped[lane].length})
            </div>
            {grouped[lane].length === 0 ? (
              <div style={{ fontSize: "11px", color: "#999", paddingBottom: "4px" }}>Nothing here yet.</div>
            ) : (
              grouped[lane].map((item) => {
                const info = deadlineInfo(item.deadline);
                return (
                  <TrackerCard
                    key={item.savedId}
                    opportunityId={item.opportunityId}
                    title={item.title}
                    org={item.org}
                    deadlineText={info.text}
                    deadlineUrgent={info.urgent}
                    initialStatus={item.status}
                  />
                );
              })
            )}
          </div>
        ))
      )}
    </div>
  );
}
