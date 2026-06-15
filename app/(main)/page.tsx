"use client";

import { useState } from "react";

const OPPORTUNITY_TYPES = ["Jobs", "Internships", "Summer Programs", "Clubs"] as const;
type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

const TYPE_LABELS: Record<OpportunityType, string> = {
  Jobs: "Job",
  Internships: "Internship",
  "Summer Programs": "Summer",
  Clubs: "Club",
};

const MOCK_LISTINGS = [
  { id: 1, title: "Software Engineering Intern", org: "Google", type: "Internships" as OpportunityType, location: "Remote", tags: ["Paid", "Summer 2026"] },
  { id: 2, title: "STEM Residential Program", org: "MIT", type: "Summer Programs" as OpportunityType, location: "Cambridge, MA", tags: ["Residential", "Grades 10–12"] },
  { id: 3, title: "Marketing & Strategy Club", org: "Yale University", type: "Clubs" as OpportunityType, location: "New Haven, CT", tags: ["Extracurricular"] },
  { id: 4, title: "Retail Associate", org: "Target", type: "Jobs" as OpportunityType, location: "New York, NY", tags: ["Part-time", "$17/hr"] },
  { id: 5, title: "Data Science Intern", org: "Meta", type: "Internships" as OpportunityType, location: "Menlo Park, CA", tags: ["Paid", "Summer 2026"] },
  { id: 6, title: "Congressional Internship", org: "U.S. House of Representatives", type: "Internships" as OpportunityType, location: "Washington, D.C.", tags: ["Unpaid", "College students"] },
  { id: 7, title: "Robotics Club", org: "Stanford University", type: "Clubs" as OpportunityType, location: "Stanford, CA", tags: ["STEM"] },
  { id: 8, title: "Young Entrepreneurs Program", org: "Babson College", type: "Summer Programs" as OpportunityType, location: "Wellesley, MA", tags: ["Residential", "Grades 9–12"] },
  { id: 9, title: "Barista", org: "Starbucks", type: "Jobs" as OpportunityType, location: "Various locations", tags: ["Part-time", "Benefits"] },
];

const s = {
  page: { display: "flex", gap: "12px", padding: "12px 16px", maxWidth: "960px", margin: "0 auto", width: "100%", boxSizing: "border-box" as const },
  panel: { background: "#e8edf5", border: "1px solid #c8d0e0", borderRadius: "3px", padding: "10px", marginBottom: "8px" },
  panelTitle: { fontWeight: "bold" as const, color: "#3b5998", fontSize: "11px", textTransform: "uppercase" as const, letterSpacing: "0.5px", borderBottom: "1px solid #c8d0e0", paddingBottom: "5px", marginBottom: "8px" },
  card: { border: "1px solid #c8d0e0", borderRadius: "3px", padding: "9px 12px", marginBottom: "5px", background: "#fff" },
  cardTitle: { fontWeight: "bold" as const, color: "#3b5998", fontSize: "13px", textDecoration: "none" as const, cursor: "pointer" as const },
  cardMeta: { color: "#666", fontSize: "11px", marginTop: "2px" },
  tag: { background: "#d8dfea", color: "#3b5998", borderRadius: "2px", padding: "1px 5px", fontSize: "10px" },
  tagGray: { background: "#f0f0f0", color: "#555", borderRadius: "2px", padding: "1px 5px", fontSize: "10px" },
  viewLink: { color: "#3b5998", fontSize: "11px", textDecoration: "underline" as const, cursor: "pointer" as const, whiteSpace: "nowrap" as const },
  label: { display: "flex" as const, alignItems: "center" as const, gap: "5px", marginBottom: "5px", fontSize: "12px", cursor: "pointer" as const },
  input: { width: "100%", boxSizing: "border-box" as const, border: "1px solid #bdc7d8", padding: "3px 6px", fontSize: "12px", borderRadius: "2px" },
};

export default function HomePage() {
  const [selected, setSelected] = useState<Set<OpportunityType>>(new Set(OPPORTUNITY_TYPES));
  const [search, setSearch] = useState("");

  function toggle(type: OpportunityType) {
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

  const filtered = MOCK_LISTINGS.filter(
    (l) =>
      selected.has(l.type) &&
      (search === "" ||
        l.title.toLowerCase().includes(search.toLowerCase()) ||
        l.org.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={s.page}>
      {/* Sidebar */}
      <aside style={{ width: "150px", flexShrink: 0 }}>
        <div style={s.panel}>
          <div style={s.panelTitle}>Type</div>
          {OPPORTUNITY_TYPES.map((type) => (
            <label key={type} style={s.label}>
              <input
                type="checkbox"
                checked={selected.has(type)}
                onChange={() => toggle(type)}
                style={{ accentColor: "#3b5998" }}
              />
              {type}
            </label>
          ))}
        </div>
        <div style={s.panel}>
          <div style={s.panelTitle}>Search</div>
          <input
            style={s.input}
            type="text"
            placeholder="Role or org..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </aside>

      {/* Listings */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "11px", color: "#666", marginBottom: "8px" }}>
          Showing {filtered.length} opportunit{filtered.length === 1 ? "y" : "ies"}
        </div>

        {filtered.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#999", padding: "20px 0" }}>No results match your filters.</div>
        ) : (
          filtered.map((listing) => (
            <div key={listing.id} style={s.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <span style={s.cardTitle}>{listing.title}</span>
                  <div style={s.cardMeta}>
                    {listing.org} &nbsp;·&nbsp; {listing.location}
                  </div>
                  <div style={{ display: "flex", gap: "4px", marginTop: "5px", flexWrap: "wrap" as const }}>
                    <span style={s.tag}>{TYPE_LABELS[listing.type]}</span>
                    {listing.tags.map((tag) => (
                      <span key={tag} style={s.tagGray}>{tag}</span>
                    ))}
                  </div>
                </div>
                <a style={s.viewLink}>View ›</a>
              </div>
            </div>
          ))
        )}

        <div style={{ marginTop: "12px", borderTop: "1px solid #e2e8f0", paddingTop: "10px", fontSize: "11px", color: "#999", textAlign: "center" as const }}>
          <a href="/sign-up" style={{ color: "#3b5998" }}>Create an account</a> to save opportunities and apply.
        </div>
      </div>
    </div>
  );
}
