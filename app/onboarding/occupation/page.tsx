"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProgressBar } from "@/components/onboarding/progress-bar";

const OCCUPATIONS = [
  {
    value: "STUDENT",
    icon: "🎓",
    title: "Student",
    description: "Looking for jobs, internships or programs",
  },
  {
    value: "OTHER",
    icon: "👤",
    title: "Other",
    description: "Something else",
  },
];

export default function OccupationPage() {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/user/onboarding/occupation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occupationType: selected }),
      });
      if (!res.ok) return;

      if (selected === "STUDENT") {
        router.push("/onboarding/student-details");
      } else {
        router.push("/profile/edit");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <ProgressBar currentStep={2} totalSteps={4} />
      <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", margin: "16px 0 2px" }}>What best describes you?</h2>
      <p style={{ fontSize: "11px", color: "#666", margin: "0 0 16px" }}>Step 2 of 4 — Occupation</p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {OCCUPATIONS.map((occ) => (
          <button
            key={occ.value}
            type="button"
            onClick={() => setSelected(occ.value)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px",
              textAlign: "left",
              width: "100%",
              cursor: "pointer",
              borderRadius: "2px",
              border: selected === occ.value ? "1px solid #29487d" : "1px solid #c8d0e0",
              background: selected === occ.value ? "#e8edf5" : "#fff",
            }}
          >
            <span style={{ fontSize: "28px" }}>{occ.icon}</span>
            <div>
              <p style={{ fontSize: "13px", fontWeight: "bold", color: "#3b5998", margin: 0 }}>{occ.title}</p>
              <p style={{ fontSize: "11px", color: "#666", margin: "2px 0 0" }}>{occ.description}</p>
            </div>
          </button>
        ))}
        <button
          type="submit"
          disabled={isLoading || !selected}
          style={{ width: "100%", marginTop: "4px", background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "6px", fontSize: "13px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer", opacity: !selected ? 0.6 : 1 }}
        >
          {isLoading ? "Saving..." : "Continue →"}
        </button>
      </form>
    </div>
  );
}
