export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#e8edf5", display: "flex", flexDirection: "column", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <header style={{ background: "#3b5998", padding: "6px 16px" }}>
        <a href="/" style={{ color: "#fff", fontWeight: "bold", fontSize: "18px", textDecoration: "none" }}>(name)</a>
      </header>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
        <div style={{ width: "100%", maxWidth: "380px", background: "#fff", border: "1px solid #c8d0e0", borderRadius: "3px", padding: "24px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
