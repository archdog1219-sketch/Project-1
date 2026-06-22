"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TYPES = ["Jobs", "Internships", "Summer Programs", "Clubs"] as const;
const GRADES = ["Grade 9", "Grade 10", "Grade 11", "Grade 12", "College"];
const INTERESTS = ["Technology", "Science", "Business", "Arts", "Politics", "Medicine", "Law", "Environment"];

export interface OpportunityFormValues {
  title: string;
  org: string;
  type: (typeof TYPES)[number];
  location: string;
  description: string;
  applyUrl: string;
  deadline: string;
  isPaid: boolean;
  targetGrades: string[];
  targetInterests: string[];
}

export default function OpportunityForm({
  mode,
  opportunityId,
  initial,
}: {
  mode: "create" | "edit";
  opportunityId?: string;
  initial: OpportunityFormValues;
}) {
  const router = useRouter();
  const [v, setV] = useState<OpportunityFormValues>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function toggle(list: string[], item: string, max?: number): string[] {
    if (list.includes(item)) return list.filter((x) => x !== item);
    if (max && list.length >= max) return list;
    return [...list, item];
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const url = mode === "create" ? "/api/opportunities" : `/api/opportunities/${opportunityId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Please check the fields and try again.");
        return;
      }
      router.push("/my-postings");
    } finally {
      setBusy(false);
    }
  }

  const label = { display: "block" as const, fontSize: "12px", fontWeight: "bold" as const, color: "#333", margin: "0 0 4px" };
  const input = { width: "100%", boxSizing: "border-box" as const, border: "1px solid #bdc7d8", padding: "5px 7px", fontSize: "13px", borderRadius: "2px" };
  const chip = (active: boolean) => ({ background: active ? "#3b5998" : "#e8edf5", color: active ? "#fff" : "#3b5998", border: active ? "1px solid #29487d" : "1px solid #c8d0e0", borderRadius: "2px", padding: "3px 9px", fontSize: "12px", cursor: "pointer" as const });
  const field = { marginBottom: "12px" };

  return (
    <form onSubmit={submit} style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      {error && (
        <div style={{ background: "#fff3f3", border: "1px solid #f5c6cb", color: "#c00", fontSize: "12px", padding: "7px 9px", borderRadius: "2px", marginBottom: "12px" }}>{error}</div>
      )}

      <div style={field}>
        <label htmlFor="title" style={label}>Title</label>
        <input id="title" style={input} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
      </div>
      <div style={field}>
        <label htmlFor="org" style={label}>Organization</label>
        <input id="org" style={input} value={v.org} onChange={(e) => setV({ ...v, org: e.target.value })} />
      </div>
      <div style={field}>
        <label htmlFor="type" style={label}>Type</label>
        <select id="type" style={input} value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as OpportunityFormValues["type"] })}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div style={field}>
        <label htmlFor="location" style={label}>Location</label>
        <input id="location" style={input} value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} placeholder="City, State or Remote" />
      </div>
      <div style={field}>
        <label htmlFor="description" style={label}>Description</label>
        <textarea id="description" rows={6} style={{ ...input, lineHeight: 1.5 }} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        <div style={{ fontSize: "10px", color: "#999", marginTop: "3px" }}>No links, emails, or phone numbers here — use the Apply URL field below.</div>
      </div>
      <div style={field}>
        <label htmlFor="applyUrl" style={label}>Apply URL <span style={{ fontWeight: "normal", color: "#666" }}>(optional)</span></label>
        <input id="applyUrl" style={input} value={v.applyUrl} onChange={(e) => setV({ ...v, applyUrl: e.target.value })} placeholder="https://..." />
      </div>
      <div style={field}>
        <label htmlFor="deadline" style={label}>Deadline <span style={{ fontWeight: "normal", color: "#666" }}>(optional)</span></label>
        <input id="deadline" style={input} value={v.deadline} onChange={(e) => setV({ ...v, deadline: e.target.value })} placeholder="e.g. March 1, 2026" />
      </div>
      <div style={field}>
        <label style={{ ...label, display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
          <input type="checkbox" checked={v.isPaid} onChange={(e) => setV({ ...v, isPaid: e.target.checked })} style={{ accentColor: "#3b5998" }} />
          This opportunity is paid
        </label>
      </div>
      <div style={field}>
        <div style={label}>Eligible grades</div>
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {GRADES.map((g) => (
            <span key={g} style={chip(v.targetGrades.includes(g))} onClick={() => setV({ ...v, targetGrades: toggle(v.targetGrades, g) })}>{g}</span>
          ))}
        </div>
      </div>
      <div style={field}>
        <div style={label}>Related interests <span style={{ fontWeight: "normal", color: "#666" }}>(up to 5)</span></div>
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {INTERESTS.map((i) => (
            <span key={i} style={chip(v.targetInterests.includes(i))} onClick={() => setV({ ...v, targetInterests: toggle(v.targetInterests, i, 5) })}>{i}</span>
          ))}
        </div>
      </div>

      <button type="submit" disabled={busy} style={{ width: "100%", background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "7px", fontSize: "13px", fontWeight: "bold", borderRadius: "2px", cursor: busy ? "default" : "pointer" }}>
        {busy ? "Saving…" : mode === "create" ? "Post opportunity" : "Save changes"}
      </button>
    </form>
  );
}
