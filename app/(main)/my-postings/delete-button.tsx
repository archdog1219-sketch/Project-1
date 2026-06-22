"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteButton({ opportunityId }: { opportunityId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("Delete this posting? This can't be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={remove} disabled={busy} style={{ background: "#fff", color: "#c00", border: "1px solid #e0b4b4", padding: "2px 8px", fontSize: "10px", borderRadius: "2px", cursor: busy ? "default" : "pointer" }}>
      {busy ? "…" : "Delete"}
    </button>
  );
}
