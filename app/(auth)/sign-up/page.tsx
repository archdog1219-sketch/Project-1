import Link from "next/link";

const card: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  border: "1px solid #c8d0e0",
  borderRadius: "2px",
  padding: "14px",
  marginBottom: "10px",
  background: "#fff",
};

export default function SignUpChooserPage() {
  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", marginBottom: "4px" }}>
        Join (name)
      </div>
      <p style={{ fontSize: "11px", color: "#666", margin: "0 0 16px" }}>
        Pick the option that describes you.
      </p>

      <Link href="/sign-up/individual" style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "28px" }}>🎓</span>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "bold", color: "#3b5998" }}>
              I&apos;m looking for opportunities
            </div>
            <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>
              Students and individuals. Sign up in a minute.
            </div>
          </div>
        </div>
      </Link>

      <Link href="/sign-up/company" style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "28px" }}>🏢</span>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "bold", color: "#3b5998" }}>
              I&apos;m hiring or posting opportunities
            </div>
            <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>
              Companies and organizations. Applications are reviewed by hand.
            </div>
          </div>
        </div>
      </Link>

      <div style={{ marginTop: "14px", fontSize: "11px", color: "#666", textAlign: "center", borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
        Already have an account? <a href="/sign-in" style={{ color: "#3b5998" }}>Sign in</a>
      </div>
    </div>
  );
}
