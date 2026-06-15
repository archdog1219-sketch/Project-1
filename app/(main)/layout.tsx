import Link from "next/link";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <header style={{ background: "#3b5998", padding: "6px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ color: "#fff", fontWeight: "bold", fontSize: "18px", textDecoration: "none" }}>
          (name)
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/sign-in" style={{ color: "#d8dfea", fontSize: "12px", textDecoration: "none" }}>
            Sign In
          </Link>
          <Link
            href="/sign-up"
            style={{ background: "#fff", color: "#3b5998", fontWeight: "bold", padding: "3px 10px", borderRadius: "3px", fontSize: "12px", textDecoration: "none" }}
          >
            Sign Up
          </Link>
        </nav>
      </header>
      <main style={{ flex: 1 }}>{children}</main>
      <footer style={{ borderTop: "1px solid #c8d0e0", padding: "10px 16px", textAlign: "center", fontSize: "11px", color: "#999" }}>
        © {new Date().getFullYear()} (name) · Built for students
      </footer>
    </div>
  );
}
