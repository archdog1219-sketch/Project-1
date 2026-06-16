"use client";

import { useState } from "react";

type Status = "SAVED" | "APPLYING" | "APPLIED" | "ACCEPTED" | null;

export default function OpportunityActions({
  opportunityId,
  initialStatus,
}: {
  opportunityId: string;
  initialStatus: Status;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [busy, setBusy] = useState(false);

  async function set(next: "SAVED" | "APPLIED") {
    setBusy(true);
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
      }
    } finally {
      setBusy(false);
    }
  }

  const btn = (bg: string, border: string, color: string) => ({
    display: "block", width: "100%", boxSizing: "border-box" as const,
    background: bg, color, border: `1px solid ${border}`,
    padding: "6px 0", fontSize: "12px", fontWeight: "bold" as const,
    borderRadius: "2px", cursor: busy ? "default" : "pointer", marginBottom: "6px",
  });

  const saved = status === "SAVED" || status === "APPLYING";
  const applied = status === "APPLIED" || status === "ACCEPTED";

  return (
    <div style={{ marginBottom: "8px" }}>
      <button disabled={busy} style={btn(saved ? "#e8edf5" : "#fff", "#c8d0e0", "#3b5998")} onClick={() => set("SAVED")}>
        {saved ? "✓ Saved" : "📌 Save"}
      </button>
      <button disabled={busy} style={btn(applied ? "#e8f5e9" : "#3b5998", applied ? "#2e7d32" : "#29487d", applied ? "#2e7d32" : "#fff")} onClick={() => set("APPLIED")}>
        {applied ? "✓ Applied" : "Mark as applied"}
      </button>
    </div>
  );
}
