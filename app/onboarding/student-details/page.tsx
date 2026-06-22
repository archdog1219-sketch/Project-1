"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { StudentLevelSelector } from "@/components/onboarding/student-level-selector";
import { ProgressBar } from "@/components/onboarding/progress-bar";

const YEARS = ["Freshman", "Sophomore", "Junior", "Senior"];

export default function StudentDetailsPage() {
  const router = useRouter();
  const [level, setLevel] = useState<"High School" | "College" | "">("");
  const [year, setYear] = useState("");
  const [degree, setDegree] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!level) e.level = "Please select your level";
    if (!year) e.year = "Please select your year";
    if (level === "College" && !degree.trim()) e.degree = "Please enter your degree";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/user/onboarding/student-details", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolLevel: level,
          graduationYear: new Date().getFullYear() + (YEARS.indexOf(year) === -1 ? 0 : 3 - YEARS.indexOf(year)),
          degree: level === "College" ? degree.trim() : undefined,
        }),
      });
      if (!res.ok) return;
      router.push("/onboarding/matching");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <ProgressBar currentStep={4} totalSteps={4} />
      <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", margin: "16px 0 2px" }}>Tell us about your education</h2>
      <p style={{ fontSize: "11px", color: "#666", margin: "0 0 16px" }}>Step 4 of 4 — Student details</p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <div>
          <p style={{ fontSize: "12px", fontWeight: "bold", color: "#333", margin: "0 0 8px" }}>High school or college?</p>
          <StudentLevelSelector selected={level} onSelect={setLevel} />
          {errors.level && <p style={{ fontSize: "11px", color: "#c00", margin: "4px 0 0" }}>{errors.level}</p>}
        </div>
        <div>
          <p style={{ fontSize: "12px", fontWeight: "bold", color: "#333", margin: "0 0 8px" }}>What year are you in?</p>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {YEARS.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                style={{
                  padding: "4px 12px",
                  fontSize: "12px",
                  cursor: "pointer",
                  borderRadius: "2px",
                  border: year === y ? "1px solid #29487d" : "1px solid #c8d0e0",
                  background: year === y ? "#3b5998" : "#e8edf5",
                  color: year === y ? "#fff" : "#3b5998",
                }}
              >
                {y}
              </button>
            ))}
          </div>
          {errors.year && <p style={{ fontSize: "11px", color: "#c00", margin: "4px 0 0" }}>{errors.year}</p>}
        </div>
        {level === "College" && (
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#333", marginBottom: "4px" }}>What degree are you pursuing?</label>
            <input
              type="text"
              placeholder="e.g. Computer Science, Business Administration"
              value={degree}
              onChange={(e) => setDegree(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #bdc7d8", padding: "5px 7px", fontSize: "13px", borderRadius: "2px" }}
            />
            {errors.degree && <p style={{ fontSize: "11px", color: "#c00", margin: "4px 0 0" }}>{errors.degree}</p>}
          </div>
        )}
        <button type="submit" disabled={isLoading} style={{ width: "100%", marginTop: "4px", background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "6px", fontSize: "13px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer" }}>
          {isLoading ? "Saving..." : "Finish setup →"}
        </button>
      </form>
    </div>
  );
}
