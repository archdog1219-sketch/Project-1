"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { signUpSchema } from "@/lib/validations";

const s = {
  title: { fontSize: "18px", fontWeight: "bold" as const, color: "#3b5998", marginBottom: "16px" },
  label: { display: "block" as const, fontSize: "12px", fontWeight: "bold" as const, color: "#333", marginBottom: "3px" },
  input: { width: "100%", boxSizing: "border-box" as const, border: "1px solid #bdc7d8", padding: "5px 7px", fontSize: "13px", borderRadius: "2px", outline: "none" },
  inputError: { width: "100%", boxSizing: "border-box" as const, border: "1px solid #c00", padding: "5px 7px", fontSize: "13px", borderRadius: "2px", outline: "none" },
  fieldError: { color: "#c00", fontSize: "11px", marginTop: "2px" },
  field: { marginBottom: "10px" },
  submitBtn: { width: "100%", background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "6px", fontSize: "13px", fontWeight: "bold" as const, borderRadius: "2px", cursor: "pointer" as const, marginTop: "4px" },
  divider: { display: "flex" as const, alignItems: "center" as const, gap: "8px", margin: "14px 0", color: "#999", fontSize: "11px" },
  line: { flex: 1, height: "1px", background: "#c8d0e0" },
  oauthBtn: { width: "100%", background: "#fff", color: "#333", border: "1px solid #c8d0e0", padding: "6px", fontSize: "12px", borderRadius: "2px", cursor: "pointer" as const, display: "flex" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: "8px", marginBottom: "6px" },
  serverError: { background: "#fff3f3", border: "1px solid #f5c6cb", color: "#c00", fontSize: "11px", padding: "6px 8px", borderRadius: "2px", marginBottom: "8px" },
  footer: { marginTop: "14px", fontSize: "11px", color: "#666", textAlign: "center" as const, borderTop: "1px solid #e2e8f0", paddingTop: "12px" },
};

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

const AppleIcon = () => (
  <svg width="15" height="18" viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg" fill="#000">
    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-155.5-127.4C46.3 790.7 0 663 0 541.8c0-207.5 135.4-317.3 269-317.3 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.6-49 192.5-49 30.8 0 108.2 2.6 168.6 71.9zm-174.4-147.4c7.7-39.5 27.1-85.5 59.8-120.5 35.1-38.2 87.5-65.4 140.3-65.4 3.2 35.1-9.7 70.1-40.2 106.1-28.9 33.8-80.2 61.6-140.3 61.6-4.5 0-9-.6-19.6-1.8z"/>
  </svg>
);

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
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
      router.push("/verify-phone?email=" + encodeURIComponent(form.email));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={s.title}>Create your account</div>
      <p style={{ fontSize: "11px", color: "#666", margin: "-10px 0 14px" }}>
        For students and individuals looking for opportunities.
      </p>

      {serverError && <div style={s.serverError}>{serverError}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ ...s.field, display: "flex", gap: "8px" }}>
          <div style={{ flex: 1 }}>
            <label style={s.label} htmlFor="firstName">First name</label>
            <input id="firstName" style={errors.firstName ? s.inputError : s.input} type="text" autoComplete="given-name" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
            {errors.firstName?.[0] && <div style={s.fieldError}>{errors.firstName[0]}</div>}
          </div>
          <div style={{ flex: 1 }}>
            <label style={s.label} htmlFor="lastName">Last name</label>
            <input id="lastName" style={errors.lastName ? s.inputError : s.input} type="text" autoComplete="family-name" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
            {errors.lastName?.[0] && <div style={s.fieldError}>{errors.lastName[0]}</div>}
          </div>
        </div>
        <div style={s.field}>
          <label style={s.label}>Email address</label>
          <input style={errors.email ? s.inputError : s.input} type="email" autoComplete="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          {errors.email?.[0] && <div style={s.fieldError}>{errors.email[0]}</div>}
        </div>
        <div style={s.field}>
          <label style={s.label}>Phone number</label>
          <input style={errors.phone ? s.inputError : s.input} type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          {errors.phone?.[0] && <div style={s.fieldError}>{errors.phone[0]}</div>}
          <div style={{ fontSize: "10px", color: "#999", marginTop: "2px" }}>We&apos;ll text you a 6-digit code to confirm it&apos;s you.</div>
        </div>
        <div style={s.field}>
          <label style={s.label}>Password</label>
          <input style={errors.password ? s.inputError : s.input} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          {errors.password?.[0] && <div style={s.fieldError}>{errors.password[0]}</div>}
        </div>
        <div style={s.field}>
          <label style={s.label}>Confirm password</label>
          <input style={errors.confirmPassword ? s.inputError : s.input} type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))} />
          {errors.confirmPassword?.[0] && <div style={s.fieldError}>{errors.confirmPassword[0]}</div>}
        </div>
        <button type="submit" style={s.submitBtn} disabled={isLoading}>
          {isLoading ? "Creating account..." : "Create account"}
        </button>
        <p style={{ fontSize: "10px", color: "#999", marginTop: "6px", textAlign: "center" }}>
          Our Terms require your real name. It isn&apos;t verified at signup — you can verify it later for a badge and boosts.
        </p>
      </form>

      <div style={s.divider}>
        <div style={s.line} />
        <span>or</span>
        <div style={s.line} />
      </div>

      <button style={s.oauthBtn} onClick={() => signIn("google", { callbackUrl: "/onboarding/basic-info" })}>
        <GoogleIcon /> Continue with Google
      </button>
      <button style={s.oauthBtn} onClick={() => signIn("apple", { callbackUrl: "/onboarding/basic-info" })}>
        <AppleIcon /> Continue with Apple
      </button>

      <div style={s.footer}>
        Already have an account? <a href="/sign-in" style={{ color: "#3b5998" }}>Sign in</a>
      </div>
    </div>
  );
}
