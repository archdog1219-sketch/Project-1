"use client";

import { useState } from "react";
import Link from "next/link";
import VerifiedBadge from "@/components/verified-badge";

export interface SuggestionView {
  id: string;
  name: string | null;
  shared: number;
  verified: boolean;
}

export default function SuggestionsRail({ initial }: { initial: SuggestionView[] }) {
  const [people, setPeople] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function follow(id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: id }),
      });
      if (res.ok) setPeople((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setBusy(null);
    }
  }

  if (people.length === 0) {
    return <div style={{ fontSize: "11px", color: "#999" }}>No suggestions right now.</div>;
  }

  return (
    <div>
      {people.map((p) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 0", borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#3b5998", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold", flexShrink: 0 }}>
            {(p.name ?? "?").slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0, fontSize: "11px" }}>
            <Link href={`/profile/${p.id}`} style={{ color: "#3b5998", fontWeight: "bold", textDecoration: "none" }}>{p.name ?? "Student"}</Link>
            {p.verified && <> <VerifiedBadge size={9} /></>}
            <div style={{ color: "#999", fontSize: "9px" }}>{p.shared} shared interest{p.shared === 1 ? "" : "s"}</div>
          </div>
          <button onClick={() => follow(p.id)} disabled={busy === p.id} style={{ background: "#e8edf5", color: "#3b5998", border: "1px solid #c8d0e0", padding: "2px 8px", fontSize: "10px", borderRadius: "2px", cursor: "pointer" }}>
            + Follow
          </button>
        </div>
      ))}
    </div>
  );
}
