"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #bdc7d8",
  padding: "6px 7px",
  fontSize: "18px",
  letterSpacing: "4px",
  textAlign: "center",
  borderRadius: "2px",
  marginBottom: "10px",
};

export default function VerifyPhoneForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/verify-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "That code is incorrect or has expired.");
        return;
      }
      router.push("/verify-email?email=" + encodeURIComponent(email));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    setNotice("");
    await fetch("/api/auth/resend-phone-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setNotice("If that account is awaiting confirmation, a new code is on its way.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div style={{ background: "#fff3f3", border: "1px solid #f5c6cb", color: "#c00", fontSize: "11px", padding: "6px 8px", borderRadius: "2px", marginBottom: "10px" }}>
          {error}
        </div>
      )}
      {notice && (
        <div style={{ background: "#f0f7ff", border: "1px solid #c8d0e0", color: "#3b5998", fontSize: "11px", padding: "6px 8px", borderRadius: "2px", marginBottom: "10px" }}>
          {notice}
        </div>
      )}

      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        style={inputStyle}
      />

      <button
        type="submit"
        disabled={isLoading || code.length !== 6}
        style={{ width: "100%", background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "6px", fontSize: "13px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer", opacity: code.length !== 6 ? 0.6 : 1 }}
      >
        {isLoading ? "Checking..." : "Confirm phone"}
      </button>

      <button
        type="button"
        onClick={handleResend}
        style={{ width: "100%", marginTop: "8px", background: "#fff", color: "#3b5998", border: "1px solid #c8d0e0", padding: "6px", fontSize: "12px", borderRadius: "2px", cursor: "pointer" }}
      >
        Send a new code
      </button>
    </form>
  );
}
