"use client";

import { useState } from "react";
import Link from "next/link";
import { OPPORTUNITY_TYPES, TYPE_LABELS, type OpportunityTypeLabel } from "@/lib/listings";
import { type OpportunityView } from "@/lib/opportunities";
import { type ScoredOpportunity } from "@/lib/matching";

const s = {
  page: { display: "flex", gap: "12px", padding: "12px 16px", maxWidth: "960px", margin: "0 auto", width: "100%", boxSizing: "border-box" as const },
  panel: { background: "#e8edf5", border: "1px solid #c8d0e0", borderRadius: "3px", padding: "10px", marginBottom: "8px" },
  panelTitle: { fontWeight: "bold" as const, color: "#3b5998", fontSize: "11px", textTransform: "uppercase" as const, letterSpacing: "0.5px", borderBottom: "1px solid #c8d0e0", paddingBottom: "5px", marginBottom: "8px" },
  card: { border: "1px solid #c8d0e0", borderRadius: "3px", padding: "9px 12px", marginBottom: "5px", background: "#fff" },
  cardTitle: { fontWeight: "bold" as const, color: "#3b5998", fontSize: "13px", textDecoration: "none" as const },
  cardMeta: { color: "#666", fontSize: "11px", marginTop: "2px" },
  tag: { background: "#d8dfea", color: "#3b5998", borderRadius: "2px", padding: "1px 5px", fontSize: "10px" },
  tagGray: { background: "#f0f0f0", color: "#555", borderRadius: "2px", padding: "1px 5px", fontSize: "10px" },
  matchBadge: { background: "#e8f5e9", color: "#2e7d32", borderRadius: "2px", padding: "1px 5px", fontSize: "10px" },
  viewLink: { color: "#3b5998", fontSize: "11px", textDecoration: "underline" as const, whiteSpace: "nowrap" as const },
  label: { display: "flex" as const, alignItems: "center" as const, gap: "5px", marginBottom: "5px", fontSize: "12px", cursor: "pointer" as const },
  input: { width: "100%", boxSizing: "border-box" as const, border: "1px solid #bdc7d8", padding: "3px 6px", fontSize: "12px", borderRadius: "2px" },
  tabBar: { display: "flex" as const, borderBottom: "2px solid #c8d0e0", marginBottom: "10px" },
};

function tabStyle(active: boolean) {
  return {
    padding: "5px 12px", fontSize: "12px", cursor: "pointer" as const,
    fontWeight: active ? ("bold" as const) : ("normal" as const),
    color: active ? "#3b5998" : "#666",
    borderBottom: active ? "2px solid #3b5998" : "2px solid transparent",
    marginBottom: "-2px",
  };
}

function Card({ listing, reason }: { listing: OpportunityView; reason?: string }) {
  return (
    <div style={s.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <Link href={`/opportunities/${listing.id}`} style={s.cardTitle}>{listing.title}</Link>
          <div style={s.cardMeta}>{listing.org} &nbsp;·&nbsp; {listing.location}</div>
          <div style={{ display: "flex", gap: "4px", marginTop: "5px", flexWrap: "wrap" as const }}>
            <span style={s.tag}>{TYPE_LABELS[listing.type]}</span>
            {reason ? <span style={s.matchBadge}>✓ {reason}</span> : null}
            {listing.tags.map((tag) => <span key={tag} style={s.tagGray}>{tag}</span>)}
          </div>
        </div>
        <Link href={`/opportunities/${listing.id}`} style={s.viewLink}>View ›</Link>
      </div>
    </div>
  );
}

export default function HomeClient({
  all,
  forYou,
  signedIn,
  profileSummary,
}: {
  all: OpportunityView[];
  forYou: ScoredOpportunity[];
  signedIn: boolean;
  profileSummary: string | null;
}) {
  const [tab, setTab] = useState<"forYou" | "all">(signedIn ? "forYou" : "all");
  const [selected, setSelected] = useState<Set<OpportunityTypeLabel>>(new Set(OPPORTUNITY_TYPES));
  const [search, setSearch] = useState("");

  function toggle(type: OpportunityTypeLabel) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  const filtered = all.filter(
    (l) =>
      selected.has(l.type) &&
      (search === "" || l.title.toLowerCase().includes(search.toLowerCase()) || l.org.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={s.page}>
        {/* Sidebar — only meaningful for the All tab */}
        <aside style={{ width: "150px", flexShrink: 0 }}>
          <div style={s.panel}>
            <div style={s.panelTitle}>Type</div>
            {OPPORTUNITY_TYPES.map((type) => (
              <label key={type} style={s.label}>
                <input type="checkbox" checked={selected.has(type)} onChange={() => toggle(type)} style={{ accentColor: "#3b5998" }} />
                {type}
              </label>
            ))}
          </div>
          <div style={s.panel}>
            <div style={s.panelTitle}>Search</div>
            <input style={s.input} type="text" placeholder="Role or org..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </aside>

        {/* Listings */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.tabBar}>
            {signedIn && (
              <div onClick={() => setTab("forYou")} style={tabStyle(tab === "forYou")}>⭐ For You</div>
            )}
            <div onClick={() => setTab("all")} style={tabStyle(tab === "all")}>All</div>
          </div>

          {tab === "forYou" && signedIn ? (
            <>
              {profileSummary && (
                <div style={{ fontSize: "10px", color: "#666", marginBottom: "6px" }}>Based on your profile: {profileSummary}</div>
              )}
              {forYou.length === 0 ? (
                <div style={{ fontSize: "12px", color: "#999", padding: "20px 0" }}>No recommendations yet.</div>
              ) : (
                forYou.map(({ opportunity, reason }) => (
                  <Card key={opportunity.id} listing={opportunity} reason={reason} />
                ))
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: "11px", color: "#666", marginBottom: "8px" }}>
                Showing {filtered.length} opportunit{filtered.length === 1 ? "y" : "ies"}
              </div>
              {filtered.length === 0 ? (
                <div style={{ fontSize: "12px", color: "#999", padding: "20px 0" }}>No results match your filters.</div>
              ) : (
                filtered.map((listing) => <Card key={listing.id} listing={listing} />)
              )}
            </>
          )}

          <div style={{ marginTop: "12px", borderTop: "1px solid #e2e8f0", paddingTop: "10px", fontSize: "11px", color: "#999", textAlign: "center" as const }}>
            <a href="/sign-up" style={{ color: "#3b5998" }}>Create an account</a> to save opportunities and apply.
          </div>
        </div>
      </div>
    </div>
  );
}
