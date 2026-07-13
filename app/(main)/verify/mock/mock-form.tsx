"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const COUNTRY_OPTIONS = [
  "United States",
  "Canada",
  "United Kingdom",
  "India",
  "Brazil",
  "Germany",
  "Japan",
  "Australia",
  "Other",
];

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: "bold",
  color: "#333",
  marginBottom: "5px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #bdc7d8",
  padding: "5px 7px",
  fontSize: "13px",
  borderRadius: "2px",
  marginBottom: "14px",
};

export default function MockForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("United States");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit(outcome: "pass" | "fail") {
    setError("");
    if (!firstName.trim() || !lastName.trim()) {
      return setError("Please enter your legal first and last name.");
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/identity/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalFirstName: firstName,
          legalLastName: lastName,
          issuingCountry: country,
          outcome,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Something went wrong. Please try again.");
        return;
      }
      router.push("/verify");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      {error && (
        <div style={{ background: "#fff3f3", border: "1px solid #f5c6cb", color: "#c00", fontSize: "11px", padding: "6px 8px", borderRadius: "2px", marginBottom: "10px" }}>
          {error}
        </div>
      )}

      <div style={labelStyle}>
        Legal first name <span style={{ fontWeight: "normal", color: "#666" }}>(as it appears on your ID)</span>
      </div>
      <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />

      <div style={labelStyle}>
        Legal last name <span style={{ fontWeight: "normal", color: "#666" }}>(as it appears on your ID)</span>
      </div>
      <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />

      <div style={labelStyle}>ID issuing country</div>
      <select value={country} onChange={(e) => setCountry(e.target.value)} style={inputStyle}>
        {COUNTRY_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <button
        onClick={() => submit("pass")}
        disabled={isLoading}
        style={{ width: "100%", background: "#e8f5e9", color: "#2e7d32", border: "1px solid #2e7d32", padding: "6px", fontSize: "13px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer", marginBottom: "8px" }}
      >
        {isLoading ? "Checking..." : "Simulate: document + selfie pass"}
      </button>
      <button
        onClick={() => submit("fail")}
        disabled={isLoading}
        style={{ width: "100%", background: "#f0f0f0", color: "#666", border: "1px solid #bbb", padding: "6px", fontSize: "13px", borderRadius: "2px", cursor: "pointer" }}
      >
        {isLoading ? "Checking..." : "Simulate: check fails"}
      </button>
    </div>
  );
}
