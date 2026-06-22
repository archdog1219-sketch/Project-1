export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#e8edf5", display: "flex", flexDirection: "column", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <header style={{ background: "#3b5998", padding: "6px 16px" }}>
        <a href="/" style={{ color: "#fff", fontWeight: "bold", fontSize: "18px", textDecoration: "none" }}>(name)</a>
      </header>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
        <div style={{ width: "100%", maxWidth: "440px", background: "#fff", border: "1px solid #c8d0e0", borderRadius: "3px", padding: "24px" }}>
          <p style={{ fontSize: "11px", fontWeight: "bold", color: "#3b5998", margin: "0 0 12px" }}>Setting up your profile</p>
          {children}
        </div>
      </div>
    </div>
  );
}
