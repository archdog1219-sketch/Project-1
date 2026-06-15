"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const INTEREST_OPTIONS = ["Technology", "Science", "Business", "Arts", "Politics", "Medicine", "Law", "Environment"];
const GPA_OPTIONS: { value: string; label: string }[] = [
  { value: "BELOW_3_0", label: "Below 3.0" },
  { value: "R3_0_3_5", label: "3.0–3.5" },
  { value: "R3_5_3_8", label: "3.5–3.8" },
  { value: "R3_8_PLUS", label: "3.8+" },
];

export default function MatchingPage() {
  const router = useRouter();
  const [gpa, setGpa] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [extra, setExtra] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function toggleInterest(i: string) {
    setInterests((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : prev.length < 5 ? [...prev, i] : prev
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!gpa) return setError("Please select your GPA range.");
    if (interests.length === 0) return setError("Pick at least one interest.");
    setIsLoading(true);
    try {
      const res = await fetch("/api/user/onboarding/matching", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gpaRange: gpa,
          interests,
          extracurriculars: extra.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) return setError("Something went wrong. Please try again.");
      router.push("/profile/edit");
    } finally {
      setIsLoading(false);
    }
  }

  const chip = (active: boolean) => ({
    background: active ? "#3b5998" : "#e8edf5",
    color: active ? "#fff" : "#3b5998",
    border: active ? "1px solid #29487d" : "1px solid #c8d0e0",
    borderRadius: "2px", padding: "4px 10px", fontSize: "12px", cursor: "pointer",
  });

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", marginBottom: "4px" }}>
        Help us find your best matches
      </div>
      <div style={{ fontSize: "11px", color: "#666", marginBottom: "16px" }}>
        Takes 60 seconds. You can always update this later.
      </div>

      {error && (
        <div style={{ background: "#fff3f3", border: "1px solid #f5c6cb", color: "#c00", fontSize: "11px", padding: "6px 8px", borderRadius: "2px", marginBottom: "10px" }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ fontSize: "12px", fontWeight: "bold", color: "#333", marginBottom: "5px" }}>GPA Range</div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "14px" }}>
          {GPA_OPTIONS.map((g) => (
            <span key={g.value} style={chip(gpa === g.value)} onClick={() => setGpa(g.value)}>{g.label}</span>
          ))}
        </div>

        <div style={{ fontSize: "12px", fontWeight: "bold", color: "#333", marginBottom: "5px" }}>
          Interests <span style={{ fontWeight: "normal", color: "#666" }}>(pick up to 5)</span>
        </div>
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginBottom: "14px" }}>
          {INTEREST_OPTIONS.map((i) => (
            <span key={i} style={chip(interests.includes(i))} onClick={() => toggleInterest(i)}>{i}</span>
          ))}
        </div>

        <div style={{ fontSize: "12px", fontWeight: "bold", color: "#333", marginBottom: "5px" }}>
          Extracurriculars <span style={{ fontWeight: "normal", color: "#666" }}>(optional, comma-separated)</span>
        </div>
        <input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="Robotics Club, Debate Team..."
          style={{ width: "100%", boxSizing: "border-box", border: "1px solid #bdc7d8", padding: "5px 7px", fontSize: "13px", borderRadius: "2px", marginBottom: "16px" }}
        />

        <button type="submit" disabled={isLoading} style={{ width: "100%", background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "6px", fontSize: "13px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer" }}>
          {isLoading ? "Saving..." : "Get my recommendations →"}
        </button>
      </form>
    </div>
  );
}
