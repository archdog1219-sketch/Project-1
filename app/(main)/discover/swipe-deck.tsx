"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TYPE_LABELS } from "@/lib/listings";
import type { ScoredOpportunity } from "@/lib/matching";

const THRESHOLD = 90; // px of drag before a release commits the swipe
const FLY_MS = 220;

export default function SwipeDeck({ initialDeck }: { initialDeck: ScoredOpportunity[] }) {
  const [deck, setDeck] = useState(initialDeck);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<"save" | "skip" | null>(null);
  const [error, setError] = useState("");
  const startX = useRef(0);

  const total = initialDeck.length;
  const current = deck[0];
  const next = deck[1];
  const position = total - deck.length + 1;

  function commit(direction: "save" | "skip") {
    if (!current || leaving) return;
    setError("");
    setLeaving(direction);
    const card = current;
    setTimeout(() => {
      setLeaving(null);
      setDx(0);
      setDeck((d) => d.slice(1));
      void (async () => {
        try {
          const res = await fetch(`/api/opportunities/${card.opportunity.id}/swipe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ direction }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setError(typeof data.error === "string" ? data.error : "That didn't save — the card is back on top.");
            setDeck((d) => [card, ...d]);
          }
        } catch {
          setError("That didn't save — the card is back on top.");
          setDeck((d) => [card, ...d]);
        }
      })();
    }, FLY_MS);
  }

  // Keyboard: ← save, → skip (matches the swipe directions).
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") commitRef.current("save");
      if (e.key === "ArrowRight") commitRef.current("skip");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (leaving) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    setDragging(true);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || leaving) return;
    setDx(e.clientX - startX.current);
  }
  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);
    if (dx <= -THRESHOLD) commit("save");
    else if (dx >= THRESHOLD) commit("skip");
    else setDx(0);
  }

  if (!current) {
    return (
      <div style={{ border: "1px solid #c8d0e0", borderRadius: "3px", background: "#fff", padding: "24px 16px", textAlign: "center" }}>
        <div style={{ fontSize: "22px", marginBottom: "6px" }}>🎉</div>
        <div style={{ fontSize: "13px", fontWeight: "bold", color: "#3b5998", marginBottom: "4px" }}>You&apos;re all caught up</div>
        <div style={{ fontSize: "11px", color: "#666", marginBottom: "10px" }}>You&apos;ve gone through every recommendation. Check back when new opportunities are posted.</div>
        <div style={{ fontSize: "11px" }}>
          <Link href="/tracker" style={{ color: "#3b5998" }}>See what you saved →</Link>
          {" · "}
          <Link href="/browse" style={{ color: "#3b5998" }}>Browse everything</Link>
        </div>
      </div>
    );
  }

  const leavingX = leaving === "save" ? -600 : leaving === "skip" ? 600 : 0;
  const x = leaving ? leavingX : dx;
  const rot = x * 0.06;
  const saveOpacity = Math.min(1, Math.max(0, (-x - 30) / (THRESHOLD - 30)));
  const skipOpacity = Math.min(1, Math.max(0, (x - 30) / (THRESHOLD - 30)));
  const o = current.opportunity;

  return (
    <div>
      <div style={{ fontSize: "10px", color: "#999", textAlign: "center", marginBottom: "6px" }}>
        {Math.min(position, total)} of {total}
      </div>

      <div style={{ position: "relative", height: "300px" }}>
        {next && (
          <div style={{ position: "absolute", inset: 0, border: "1px solid #c8d0e0", borderRadius: "4px", background: "#fff", transform: "scale(0.96) translateY(8px)", opacity: 0.6 }} />
        )}

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: "absolute", inset: 0,
            border: "1px solid #c8d0e0", borderRadius: "4px", background: "#fff",
            padding: "14px 16px", cursor: dragging ? "grabbing" : "grab",
            touchAction: "none", userSelect: "none",
            transform: `translateX(${x}px) rotate(${rot}deg)`,
            transition: dragging ? "none" : `transform ${FLY_MS}ms ease, opacity ${FLY_MS}ms ease`,
            opacity: leaving ? 0 : 1,
            display: "flex", flexDirection: "column",
          }}
        >
          {/* stamps */}
          <div style={{ position: "absolute", top: "12px", left: "12px", border: "2px solid #2e7d32", color: "#2e7d32", fontWeight: "bold", fontSize: "14px", padding: "2px 10px", borderRadius: "3px", transform: "rotate(-12deg)", opacity: saveOpacity }}>SAVE 💾</div>
          <div style={{ position: "absolute", top: "12px", right: "12px", border: "2px solid #999", color: "#999", fontWeight: "bold", fontSize: "14px", padding: "2px 10px", borderRadius: "3px", transform: "rotate(12deg)", opacity: skipOpacity }}>SKIP ✕</div>

          <div style={{ fontSize: "15px", fontWeight: "bold", color: "#3b5998", marginTop: "18px" }}>{o.title}</div>
          <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>{o.org} &nbsp;·&nbsp; {o.location}</div>

          <div style={{ display: "flex", gap: "4px", marginTop: "8px", flexWrap: "wrap" }}>
            <span style={{ background: "#d8dfea", color: "#3b5998", borderRadius: "2px", padding: "1px 6px", fontSize: "10px", fontWeight: "bold" }}>{TYPE_LABELS[o.type]}</span>
            {current.reason && (
              <span style={{ background: "#e8f5e9", color: "#2e7d32", borderRadius: "2px", padding: "1px 6px", fontSize: "10px" }}>✓ {current.reason}</span>
            )}
            {o.deadline && (
              <span style={{ background: "#fff3e0", color: "#b26a00", borderRadius: "2px", padding: "1px 6px", fontSize: "10px" }}>⏰ {o.deadline}</span>
            )}
          </div>

          <p style={{ fontSize: "12px", color: "#333", lineHeight: 1.5, marginTop: "10px", flex: 1, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical" }}>
            {o.description}
          </p>

          <div style={{ marginTop: "8px" }}>
            <Link
              href={`/opportunities/${o.id}`}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ fontSize: "11px", color: "#3b5998", textDecoration: "underline" }}
            >
              View full details →
            </Link>
          </div>
        </div>
      </div>

      {error && <div style={{ color: "#c00", fontSize: "11px", textAlign: "center", marginTop: "8px" }}>{error}</div>}

      <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "12px" }}>
        <button
          onClick={() => commit("save")}
          disabled={!!leaving}
          style={{ background: "#e8f5e9", color: "#2e7d32", border: "1px solid #2e7d32", padding: "7px 18px", fontSize: "12px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer" }}
        >
          💾 Save (←)
        </button>
        <button
          onClick={() => commit("skip")}
          disabled={!!leaving}
          style={{ background: "#f0f0f0", color: "#555", border: "1px solid #bbb", padding: "7px 18px", fontSize: "12px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer" }}
        >
          Skip ✕ (→)
        </button>
      </div>
    </div>
  );
}
