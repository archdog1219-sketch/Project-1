"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const s = {
  label: { display: "block" as const, fontSize: "12px", fontWeight: "bold" as const, color: "#333", marginBottom: "3px" },
  input: { width: "100%", boxSizing: "border-box" as const, border: "1px solid #bdc7d8", padding: "5px 7px", fontSize: "13px", borderRadius: "2px", outline: "none" },
  inputError: { width: "100%", boxSizing: "border-box" as const, border: "1px solid #c00", padding: "5px 7px", fontSize: "13px", borderRadius: "2px", outline: "none" },
  fieldError: { color: "#c00", fontSize: "11px", marginTop: "2px" },
  field: { marginBottom: "10px" },
};

export default function SetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    setErrors({});
    setIsLoading(true);
    try {
      const res = await fetch("/api/company/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.error === "object") setErrors(data.error);
        else setServerError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/sign-in");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {serverError && (
        <div style={{ background: "#fff3f3", border: "1px solid #f5c6cb", color: "#c00", fontSize: "11px", padding: "6px 8px", borderRadius: "2px", marginBottom: "8px" }}>
          {serverError}
        </div>
      )}

      <div style={s.field}>
        <label style={s.label}>Password</label>
        <input style={errors.password ? s.inputError : s.input} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {errors.password?.[0] && <div style={s.fieldError}>{errors.password[0]}</div>}
      </div>
      <div style={s.field}>
        <label style={s.label}>Confirm password</label>
        <input style={errors.confirmPassword ? s.inputError : s.input} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        {errors.confirmPassword?.[0] && <div style={s.fieldError}>{errors.confirmPassword[0]}</div>}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        style={{ width: "100%", background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "6px", fontSize: "13px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer", marginTop: "4px" }}
      >
        {isLoading ? "Saving..." : "Set password and continue"}
      </button>
    </form>
  );
}
