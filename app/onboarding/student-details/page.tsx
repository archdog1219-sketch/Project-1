"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { StudentLevelSelector } from "@/components/onboarding/student-level-selector";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
      router.push("/profile/edit");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <ProgressBar currentStep={4} totalSteps={4} />
      <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-1">Tell us about your education</h2>
      <p className="text-sm text-gray-500 mb-6">Step 4 of 4 — Student details</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">High school or college?</p>
          <StudentLevelSelector selected={level} onSelect={setLevel} />
          {errors.level && <p className="text-xs text-red-500 mt-1">{errors.level}</p>}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">What year are you in?</p>
          <div className="flex gap-2 flex-wrap">
            {YEARS.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  year === y
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
          {errors.year && <p className="text-xs text-red-500 mt-1">{errors.year}</p>}
        </div>
        {level === "College" && (
          <Input
            label="What degree are you pursuing?"
            type="text"
            placeholder="e.g. Computer Science, Business Administration"
            value={degree}
            onChange={(e) => setDegree(e.target.value)}
            error={errors.degree}
          />
        )}
        <Button type="submit" isLoading={isLoading} className="w-full mt-2">
          Finish setup →
        </Button>
      </form>
    </div>
  );
}
