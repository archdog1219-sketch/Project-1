"use client";

import { useState } from "react";
import Link from "next/link";
import { OPPORTUNITY_TYPES, TYPE_LABELS, type OpportunityTypeLabel } from "@/lib/listings";
import { type OpportunityView } from "@/lib/opportunities";
import VerifiedBadge from "@/components/verified-badge";

const s = {
  page: { display: "flex", gap: "12px", padding: "12px 16px", maxWidth: "960px", margin: "0 auto", width: "100%", boxSizing: "border-box" as const },
  panel: { background: "#e8edf5", border: "1px solid #c8d0e0", borderRadius: "3px", padding: "10px", marginBottom: "8px" },
  panelTitle: { fontWeight: "bold" as const, color: "#3b5998", fontSize: "11px", textTransform: "uppercase" as const, letterSpacing: "0.5px", borderBottom: "1px solid #c8d0e0", paddingBottom: "5px", marginBottom: "8px" },
  card: { border: "1px solid #c8d0e0", borderRadius: "3px", padding: "9px 12px", marginBottom: "5px", background: "#fff" },
  cardTitle: { fontWeight: "bold" as const, color: "#3b5998", fontSize: "13px", textDecoration: "none" as const },
  cardMeta: { color: "#666", fontSize: "11px", marginTop: "2px" },
  tag: { background: "#d8dfea", color: "#3b5998", borderRadius: "2px", padding: "1px 5px", fontSize: "10px" },
  tagGray: { background: "#f0f0f0", color: "#555", borderRadius: "2px", padding: "1px 5px", fontSize: "10px" },
  viewLink: { color: "#3b5998", fontSize: "11px", textDecoration: "underline" as const, whiteSpace: "nowrap" as const },
  label: { display: "flex" as const, alignItems: "center" as const, gap: "5px", marginBottom: "5px", fontSize: "12px", cursor: "pointer" as const },
  input: { width: "100%", boxSizing: "border-box" as const, border: "1px solid #bdc7d8", padding: "3px 6px", fontSize: "12px", borderRadius: "2px" },
};

export default function BrowseClient({ listings }: { listings: OpportunityView[] }) {
  const [selected, setSelected] = useState<Set<OpportunityTypeLabel>>(new Set(OPPORTUNITY_TYPES));
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");

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

  const filtered = listings.filter((l) => {
    if (!selected.has(l.type)) return false;
    if (search && !l.title.toLowerCase().includes(search.toLowerCase()) && !l.org.toLowerCase().includes(search.toLowerCase())) return false;
    if (location && !l.location.toLowerCase().includes(location.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      {/* Page header */}
      <div style={{ background: "#e8edf5", borderBottom: "1px solid #c8d0e0", padding: "8px 16px" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", fontSize: "13px", color: "#3b5998", fontWeight: "bold" }}>
          Browse Opportunities
        </div>
      </div>

      <div style={s.page}>
        {/* Sidebar */}
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
            <div style={s.panelTitle}>Keyword</div>
            <input style={s.input} type="text" placeholder="Role or org..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={s.panel}>
            <div style={s.panelTitle}>Location</div>
            <input style={s.input} type="text" placeholder="City or Remote..." value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </aside>

        {/* Listings */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "11px", color: "#666", marginBottom: "8px" }}>
            {filtered.length} opportunit{filtered.length === 1 ? "y" : "ies"} found
          </div>

          {filtered.length === 0 ? (
            <div style={{ fontSize: "12px", color: "#999", padding: "20px 0" }}>No results match your filters.</div>
          ) : (
            filtered.map((listing) => (
              <div key={listing.id} style={s.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/opportunities/${listing.id}`} style={s.cardTitle}>{listing.title}</Link>
                    <div style={s.cardMeta}>{listing.org} &nbsp;·&nbsp; {listing.location}</div>
                    <div style={{ display: "flex", gap: "4px", marginTop: "5px", flexWrap: "wrap" as const }}>
                      <span style={s.tag}>{TYPE_LABELS[listing.type]}</span>
                      {listing.ownerVerified && <VerifiedBadge size={9} />}
                      {listing.tags.map((tag) => <span key={tag} style={s.tagGray}>{tag}</span>)}
                    </div>
                  </div>
                  <Link href={`/opportunities/${listing.id}`} style={s.viewLink}>View ›</Link>
                </div>
              </div>
            ))
          )}

          <div style={{ marginTop: "12px", borderTop: "1px solid #e2e8f0", paddingTop: "10px", fontSize: "11px", color: "#999", textAlign: "center" as const }}>
            <a href="/sign-up" style={{ color: "#3b5998" }}>Create an account</a> to save opportunities and apply.
          </div>
        </div>
      </div>
    </div>
  );
}
