"use client";

import { useState } from "react";

const OPPORTUNITY_TYPES = ["Jobs", "Internships", "Summer Programs", "Clubs"] as const;
type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

const MOCK_LISTINGS = [
  {
    id: 1,
    title: "Software Engineering Intern",
    org: "Google",
    type: "Internships" as OpportunityType,
    location: "Remote",
    tags: ["Paid", "Summer 2026"],
    grade: null,
  },
  {
    id: 2,
    title: "STEM Residential Program",
    org: "MIT",
    type: "Summer Programs" as OpportunityType,
    location: "Cambridge, MA",
    tags: ["Residential", "6 weeks"],
    grade: "Grades 10–12",
  },
  {
    id: 3,
    title: "Marketing & Strategy Club",
    org: "Yale University",
    type: "Clubs" as OpportunityType,
    location: "New Haven, CT",
    tags: ["Extracurricular", "All grades"],
    grade: null,
  },
  {
    id: 4,
    title: "Retail Associate",
    org: "Target",
    type: "Jobs" as OpportunityType,
    location: "New York, NY",
    tags: ["Part-time", "$17/hr"],
    grade: null,
  },
  {
    id: 5,
    title: "Data Science Intern",
    org: "Meta",
    type: "Internships" as OpportunityType,
    location: "Menlo Park, CA",
    tags: ["Paid", "Summer 2026"],
    grade: null,
  },
  {
    id: 6,
    title: "Congressional Internship",
    org: "U.S. House of Representatives",
    type: "Internships" as OpportunityType,
    location: "Washington, D.C.",
    tags: ["Unpaid", "Spring/Summer"],
    grade: "College students",
  },
  {
    id: 7,
    title: "Robotics Club",
    org: "Stanford University",
    type: "Clubs" as OpportunityType,
    location: "Stanford, CA",
    tags: ["Extracurricular", "STEM"],
    grade: null,
  },
  {
    id: 8,
    title: "Young Entrepreneurs Program",
    org: "Babson College",
    type: "Summer Programs" as OpportunityType,
    location: "Wellesley, MA",
    tags: ["Residential", "2 weeks"],
    grade: "Grades 9–12",
  },
  {
    id: 9,
    title: "Barista",
    org: "Starbucks",
    type: "Jobs" as OpportunityType,
    location: "Various locations",
    tags: ["Part-time", "Benefits"],
    grade: null,
  },
];

const TYPE_COLORS: Record<OpportunityType, string> = {
  Jobs: "bg-emerald-100 text-emerald-700",
  Internships: "bg-indigo-100 text-indigo-700",
  "Summer Programs": "bg-amber-100 text-amber-700",
  Clubs: "bg-rose-100 text-rose-700",
};

export default function HomePage() {
  const [selected, setSelected] = useState<Set<OpportunityType>>(
    new Set(OPPORTUNITY_TYPES)
  );
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex gap-6 items-start">
        {/* Sidebar */}
        <aside className="w-52 shrink-0 bg-indigo-600 text-white rounded-xl p-5 sticky top-20">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200 mb-3">
            Opportunity Type
          </p>
          <ul className="space-y-2">
            {OPPORTUNITY_TYPES.map((type) => (
              <li key={type}>
                <button
                  onClick={() => toggle(type)}
                  className={`w-full text-left flex items-center gap-2 text-sm rounded-md px-2 py-1.5 transition-colors ${
                    selected.has(type)
                      ? "bg-indigo-500 text-white"
                      : "text-indigo-300 hover:text-white hover:bg-indigo-700"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      selected.has(type)
                        ? "bg-white border-white"
                        : "border-indigo-400"
                    }`}
                  >
                    {selected.has(type) && (
                      <svg className="w-3 h-3 text-indigo-600" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  {type}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-6 pt-5 border-t border-indigo-500">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200 mb-3">
              Search
            </p>
            <input
              type="text"
              placeholder="Role or organization..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-indigo-700 placeholder-indigo-300 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">
              {filtered.length} opportunit{filtered.length === 1 ? "y" : "ies"}
            </p>
            <a
              href="/sign-up"
              className="text-sm text-indigo-600 hover:underline font-medium"
            >
              Sign up to save & apply →
            </a>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              No results match your filters.
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((listing) => (
                <li
                  key={listing.id}
                  className="bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {listing.title}
                      </h3>
                      <p className="text-indigo-600 text-sm mt-0.5">{listing.org}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[listing.type]}`}
                        >
                          {listing.type}
                        </span>
                        {listing.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                        {listing.grade && (
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            {listing.grade}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-slate-400 shrink-0 mt-0.5">
                      {listing.location}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
