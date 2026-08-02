"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EmailPrompt() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim()) router.push("/verify-phone?email=" + encodeURIComponent(email.trim()));
      }}
    >
      <p style={{ fontSize: "12px", color: "#666", margin: "0 0 8px" }}>
        Enter the email address you signed up with and we&apos;ll pick up where you left off.
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", boxSizing: "border-box", border: "1px solid #bdc7d8", padding: "5px 7px", fontSize: "13px", borderRadius: "2px", marginBottom: "8px" }}
      />
      <button
        type="submit"
        style={{ width: "100%", background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "6px", fontSize: "13px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer" }}
      >
        Continue
      </button>
    </form>
  );
}
