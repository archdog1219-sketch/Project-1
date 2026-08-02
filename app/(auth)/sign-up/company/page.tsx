"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { companyApplicationSchema } from "@/lib/validations";

const s = {
  label: { display: "block" as const, fontSize: "12px", fontWeight: "bold" as const, color: "#333", marginBottom: "3px" },
  input: { width: "100%", boxSizing: "border-box" as const, border: "1px solid #bdc7d8", padding: "5px 7px", fontSize: "13px", borderRadius: "2px", outline: "none" },
  inputError: { width: "100%", boxSizing: "border-box" as const, border: "1px solid #c00", padding: "5px 7px", fontSize: "13px", borderRadius: "2px", outline: "none" },
  fieldError: { color: "#c00", fontSize: "11px", marginTop: "2px" },
  field: { marginBottom: "10px" },
};

export default function CompanySignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({ companyName: "", contactName: "", workEmail: "", website: "", description: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    const parsed = companyApplicationSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setIsLoading(true);
    try {
      const res = await fetch("/api/company-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.error === "object") setErrors(data.error);
        else setServerError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/sign-up/company/submitted");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", marginBottom: "4px" }}>
        Apply to post opportunities
      </div>
      <p style={{ fontSize: "11px", color: "#666", margin: "0 0 14px" }}>
        We review every company by hand while we&apos;re getting started. Tell us
        about you and we&apos;ll email you once you&apos;re approved.
      </p>

      {serverError && (
        <div style={{ background: "#fff3f3", border: "1px solid #f5c6cb", color: "#c00", fontSize: "11px", padding: "6px 8px", borderRadius: "2px", marginBottom: "8px" }}>
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={s.field}>
          <label style={s.label}>Company name</label>
          <input style={errors.companyName ? s.inputError : s.input} value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} />
          {errors.companyName?.[0] && <div style={s.fieldError}>{errors.companyName[0]}</div>}
        </div>
        <div style={s.field}>
          <label style={s.label}>Your name</label>
          <input style={errors.contactName ? s.inputError : s.input} autoComplete="name" value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} />
          {errors.contactName?.[0] && <div style={s.fieldError}>{errors.contactName[0]}</div>}
        </div>
        <div style={s.field}>
          <label style={s.label}>Work email</label>
          <input style={errors.workEmail ? s.inputError : s.input} type="email" autoComplete="email" value={form.workEmail} onChange={(e) => setForm((f) => ({ ...f, workEmail: e.target.value }))} />
          {errors.workEmail?.[0] && <div style={s.fieldError}>{errors.workEmail[0]}</div>}
        </div>
        <div style={s.field}>
          <label style={s.label}>Website <span style={{ fontWeight: "normal", color: "#666" }}>(optional)</span></label>
          <input style={errors.website ? s.inputError : s.input} placeholder="https://" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
          {errors.website?.[0] && <div style={s.fieldError}>{errors.website[0]}</div>}
        </div>
        <div style={s.field}>
          <label style={s.label}>What are you hiring for? <span style={{ fontWeight: "normal", color: "#666" }}>(optional)</span></label>
          <textarea rows={4} style={{ ...s.input, resize: "vertical" }} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          {errors.description?.[0] && <div style={s.fieldError}>{errors.description[0]}</div>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          style={{ width: "100%", background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "6px", fontSize: "13px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer", marginTop: "4px" }}
        >
          {isLoading ? "Submitting..." : "Submit application"}
        </button>
        <p style={{ fontSize: "10px", color: "#999", marginTop: "6px", textAlign: "center" }}>
          You&apos;ll set a password after you&apos;re approved.
        </p>
      </form>
    </div>
  );
}
