"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface AdminApplication {
  id: string;
  companyName: string;
  contactName: string;
  workEmail: string;
  website: string | null;
  description: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  decidedAt: string | null;
}

const STATUS_COLORS: Record<AdminApplication["status"], { bg: string; fg: string }> = {
  PENDING: { bg: "#fff8e1", fg: "#7a5c00" },
  APPROVED: { bg: "#e8f5e9", fg: "#2e7d32" },
  REJECTED: { bg: "#f0f0f0", fg: "#666" },
};

export default function AdminClient({ applications }: { applications: AdminApplication[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const visible = applications.filter((a) => a.status === filter);

  async function decide(id: string, action: "approve" | "reject") {
    setError("");
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/company-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Something went wrong.");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif", maxWidth: "760px", margin: "0 auto", padding: "20px 16px" }}>
      <div style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", marginBottom: "10px" }}>
        Company applications
      </div>

      <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              fontSize: "12px",
              padding: "4px 10px",
              borderRadius: "2px",
              cursor: "pointer",
              border: filter === s ? "1px solid #29487d" : "1px solid #c8d0e0",
              background: filter === s ? "#e8edf5" : "#fff",
              color: "#3b5998",
              fontWeight: filter === s ? "bold" : "normal",
            }}
          >
            {s[0] + s.slice(1).toLowerCase()} ({applications.filter((a) => a.status === s).length})
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: "#fff3f3", border: "1px solid #f5c6cb", color: "#c00", fontSize: "11px", padding: "6px 8px", borderRadius: "2px", marginBottom: "10px" }}>
          {error}
        </div>
      )}

      {visible.length === 0 && (
        <p style={{ fontSize: "12px", color: "#666" }}>Nothing here.</p>
      )}

      {visible.map((a) => (
        <div key={a.id} style={{ border: "1px solid #c8d0e0", borderRadius: "2px", background: "#fff", padding: "12px", marginBottom: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
            <div style={{ fontSize: "14px", fontWeight: "bold", color: "#3b5998" }}>{a.companyName}</div>
            <span style={{ fontSize: "10px", fontWeight: "bold", padding: "1px 6px", borderRadius: "2px", background: STATUS_COLORS[a.status].bg, color: STATUS_COLORS[a.status].fg }}>
              {a.status}
            </span>
          </div>
          <div style={{ fontSize: "12px", color: "#333", marginTop: "4px" }}>
            {a.contactName} — {a.workEmail}
          </div>
          {a.website && (
            <div style={{ fontSize: "12px", marginTop: "2px" }}>
              <a href={a.website} target="_blank" rel="noopener noreferrer" style={{ color: "#3b5998" }}>{a.website}</a>
            </div>
          )}
          {a.description && (
            <p style={{ fontSize: "12px", color: "#444", marginTop: "6px", whiteSpace: "pre-wrap" }}>{a.description}</p>
          )}
          <div style={{ fontSize: "10px", color: "#999", marginTop: "6px" }}>
            Applied {new Date(a.createdAt).toLocaleString()}
            {a.decidedAt && ` · Decided ${new Date(a.decidedAt).toLocaleString()}`}
          </div>

          {a.status === "PENDING" && (
            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <button
                onClick={() => decide(a.id, "approve")}
                disabled={busyId === a.id}
                style={{ background: "#e8f5e9", color: "#2e7d32", border: "1px solid #2e7d32", padding: "5px 12px", fontSize: "12px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer" }}
              >
                {busyId === a.id ? "Working..." : "Approve"}
              </button>
              <button
                onClick={() => decide(a.id, "reject")}
                disabled={busyId === a.id}
                style={{ background: "#f0f0f0", color: "#666", border: "1px solid #bbb", padding: "5px 12px", fontSize: "12px", borderRadius: "2px", cursor: "pointer" }}
              >
                {busyId === a.id ? "Working..." : "Reject"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
