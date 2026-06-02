"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import { basicInfoSchema } from "@/lib/validations";

export default function BasicInfoPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", dateOfBirth: "", city: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    const parsed = basicInfoSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setIsLoading(true);
    try {
      const res = await fetch("/api/user/onboarding/basic-info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/onboarding/occupation");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <ProgressBar currentStep={1} totalSteps={4} />
      <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-1">Tell us about yourself</h2>
      <p className="text-sm text-gray-500 mb-6">Step 1 of 4 — Basic info</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Full name"
          type="text"
          autoComplete="name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          error={errors.name?.[0]}
        />
        <Input
          label="Date of birth"
          type="date"
          value={form.dateOfBirth}
          onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
          error={errors.dateOfBirth?.[0]}
        />
        <Input
          label="City"
          type="text"
          placeholder="e.g. Chicago"
          value={form.city}
          onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          error={errors.city?.[0]}
        />
        {serverError && <p className="text-sm text-red-500">{serverError}</p>}
        <Button type="submit" isLoading={isLoading} className="w-full mt-2">
          Continue →
        </Button>
      </form>
    </div>
  );
}
