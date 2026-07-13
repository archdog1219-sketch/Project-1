"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleStart() {
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/identity/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Something went wrong. Please try again.");
        return;
      }
      router.push(data.url);
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
      <button
        onClick={handleStart}
        disabled={isLoading}
        style={{ width: "100%", background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "6px", fontSize: "13px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer" }}
      >
        {isLoading ? "Starting..." : "Start verification →"}
      </button>
    </div>
  );
}
