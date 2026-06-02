"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { OccupationCard } from "@/components/ui/occupation-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/onboarding/progress-bar";

const OCCUPATIONS = [
  {
    value: "STUDENT",
    icon: "🎓",
    title: "Student",
    description: "Looking for jobs, internships or programs",
  },
  {
    value: "EMPLOYER",
    icon: "🏢",
    title: "Employer / Company",
    description: "Posting opportunities, hiring students",
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
  const [companyName, setCompanyName] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (selected === "EMPLOYER" && !companyName.trim()) {
      setCompanyError("Company name is required");
      return;
    }
    setCompanyError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/user/onboarding/occupation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occupationType: selected, companyName: companyName.trim() || undefined }),
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
    <div>
      <ProgressBar currentStep={2} totalSteps={4} />
      <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-1">What best describes you?</h2>
      <p className="text-sm text-gray-500 mb-6">Step 2 of 4 — Occupation</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {OCCUPATIONS.map((occ) => (
          <OccupationCard
            key={occ.value}
            {...occ}
            selected={selected === occ.value}
            onSelect={setSelected}
          />
        ))}
        {selected === "EMPLOYER" && (
          <Input
            label="Company name"
            type="text"
            placeholder="e.g. Acme Corp"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            error={companyError}
          />
        )}
        <Button
          type="submit"
          isLoading={isLoading}
          disabled={!selected}
          className="w-full mt-2"
        >
          Continue →
        </Button>
      </form>
    </div>
  );
}
