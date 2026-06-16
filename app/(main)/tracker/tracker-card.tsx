"use client";

import { useState } from "react";
import Link from "next/link";
import type { TrackerStatus } from "@/lib/tracker-logic";

export default function TrackerCard({
  opportunityId,
  title,
  org,
  deadlineText,
  deadlineUrgent,
  initialStatus,
}: {
  opportunityId: string;
  title: string;
  org: string;
  deadlineText: string;
  deadlineUrgent: boolean;
  initialStatus: TrackerStatus;
}) {
  const [status, setStatus] = useState<TrackerStatus>(initialStatus);
  const [busy, setBusy] = useState(false);

  async function change(next: TrackerStatus) {
    const prev = status;
    setStatus(next); // optimistic
    setBusy(true);
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) setStatus(prev); // revert on failure
    } catch {
      setStatus(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ border: deadlineUrgent ? "1px solid #f5b800" : "1px solid #c8d0e0", background: deadlineUrgent ? "#fffdf5" : "#fff", borderRadius: "3px", padding: "7px 9px", marginBottom: "5px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
        <div style={{ minWidth: 0 }}>
          <Link href={`/opportunities/${opportunityId}`} style={{ color: "#3b5998", fontWeight: "bold", fontSize: "12px", textDecoration: "none" }}>{title}</Link>
          <div style={{ fontSize: "10px", color: deadlineUrgent ? "#c00" : "#666", fontWeight: deadlineUrgent ? "bold" : "normal" }}>
            {org} · {deadlineUrgent ? "⏰ " : ""}{deadlineText}
          </div>
        </div>
        <select
          value={status}
          disabled={busy}
          onChange={(e) => change(e.target.value as TrackerStatus)}
          style={{ border: "1px solid #bdc7d8", fontSize: "10px", padding: "2px", borderRadius: "2px" }}
        >
          <option value="SAVED">Saved</option>
          <option value="APPLYING">Applying</option>
          <option value="APPLIED">Applied</option>
        </select>
      </div>
    </div>
  );
}
