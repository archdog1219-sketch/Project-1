"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import { basicInfoSchema } from "@/lib/validations";

const labelStyle = { display: "block", fontSize: "12px", fontWeight: "bold", color: "#333", marginBottom: "4px" } as const;
const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #bdc7d8", padding: "5px 7px", fontSize: "13px", borderRadius: "2px" } as const;
const errorStyle = { fontSize: "11px", color: "#c00", margin: "4px 0 0" } as const;

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
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <ProgressBar currentStep={1} totalSteps={4} />
      <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", margin: "16px 0 2px" }}>Tell us about yourself</h2>
      <p style={{ fontSize: "11px", color: "#666", margin: "0 0 16px" }}>Step 1 of 4 — Basic info</p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div>
          <label style={labelStyle}>Full name</label>
          <input
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            style={inputStyle}
          />
          {errors.name?.[0] && <p style={errorStyle}>{errors.name[0]}</p>}
        </div>
        <div>
          <label style={labelStyle}>Date of birth</label>
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
            style={inputStyle}
          />
          {errors.dateOfBirth?.[0] && <p style={errorStyle}>{errors.dateOfBirth[0]}</p>}
        </div>
        <div>
          <label style={labelStyle}>City</label>
          <input
            type="text"
            placeholder="e.g. Chicago"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            style={inputStyle}
          />
          {errors.city?.[0] && <p style={errorStyle}>{errors.city[0]}</p>}
        </div>
        {serverError && <p style={errorStyle}>{serverError}</p>}
        <button type="submit" disabled={isLoading} style={{ width: "100%", marginTop: "4px", background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "6px", fontSize: "13px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer" }}>
          {isLoading ? "Saving..." : "Continue →"}
        </button>
      </form>
    </div>
  );
}
