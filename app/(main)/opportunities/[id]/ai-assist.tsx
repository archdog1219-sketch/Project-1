"use client";

import { useState } from "react";

export default function AiAssist({
  opportunityId,
  initialDraft,
}: {
  opportunityId: string;
  initialDraft: string | null;
}) {
  const [draft, setDraft] = useState<string>(initialDraft ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}/draft`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setDraft(data.content);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const smallBtn = {
    background: "#e8edf5", color: "#3b5998", border: "1px solid #c8d0e0",
    padding: "3px 10px", fontSize: "10px", borderRadius: "2px", cursor: "pointer", marginRight: "6px",
  };

  return (
    <div style={{ border: "1px solid #c8d0e0", borderRadius: "3px", background: "#fff", marginTop: "10px" }}>
      <div style={{ background: "#3b5998", color: "#fff", padding: "8px 12px", fontSize: "11px", fontWeight: "bold" }}>
        ✨ AI Application Assist
      </div>
      <div style={{ padding: "10px 12px" }}>
        {draft === "" ? (
          <div style={{ fontSize: "11px", color: "#666", marginBottom: "8px" }}>
            Generate a cover-letter draft tailored to your profile and this role.
          </div>
        ) : (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            style={{ width: "100%", boxSizing: "border-box", border: "1px solid #bdc7d8", borderRadius: "2px", fontSize: "11px", padding: "6px", fontFamily: "Arial, Helvetica, sans-serif", lineHeight: 1.5, marginBottom: "8px" }}
          />
        )}

        {error && <div style={{ color: "#c00", fontSize: "11px", marginBottom: "8px" }}>{error}</div>}

        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px" }}>
          <button onClick={generate} disabled={busy} style={{ background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "4px 12px", fontSize: "11px", fontWeight: "bold", borderRadius: "2px", cursor: busy ? "default" : "pointer" }}>
            {busy ? "Generating…" : draft === "" ? "Generate draft →" : "🔄 Regenerate"}
          </button>
          {draft !== "" && (
            <button onClick={copy} style={smallBtn}>{copied ? "✓ Copied" : "📋 Copy"}</button>
          )}
        </div>

        {draft !== "" && (
          <div style={{ fontSize: "9px", color: "#999", marginTop: "8px", lineHeight: 1.4 }}>
            AI-generated from your profile. Always review and personalize before sending.
          </div>
        )}
      </div>
    </div>
  );
}
