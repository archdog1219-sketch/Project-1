import Link from "next/link";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <style>{`
        .nav-link { color: #d8dfea; font-size: 12px; text-decoration: none; padding: 6px 10px; display: inline-block; }
        .nav-link:hover { color: #fff; }
      `}</style>
      <header style={{ background: "#3b5998" }}>
        {/* Top bar: logo + auth */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 16px", borderBottom: "1px solid #2d4373" }}>
          <Link href="/" style={{ color: "#fff", fontWeight: "bold", fontSize: "18px", textDecoration: "none" }}>
            (name)
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link href="/sign-in" style={{ color: "#d8dfea", fontSize: "12px", textDecoration: "none" }}>
              Sign In
            </Link>
            <Link
              href="/sign-up"
              style={{ background: "#fff", color: "#3b5998", fontWeight: "bold", padding: "3px 10px", borderRadius: "3px", fontSize: "12px", textDecoration: "none" }}
            >
              Sign Up
            </Link>
          </div>
        </div>
        {/* Nav links */}
        <nav style={{ display: "flex", alignItems: "center", padding: "0 12px" }}>
          <Link href="/" className="nav-link">Home</Link>
          <Link href="/feed" className="nav-link">Feed</Link>
          <Link href="/tracker" className="nav-link">Tracker</Link>
          <Link href="/browse" className="nav-link">Browse</Link>
          <Link href="/about" className="nav-link">About</Link>
        </nav>
      </header>
      <main style={{ flex: 1 }}>{children}</main>
      <footer style={{ borderTop: "1px solid #c8d0e0", padding: "10px 16px", textAlign: "center", fontSize: "11px", color: "#999" }}>
        © {new Date().getFullYear()} (name) · Built for students
      </footer>
    </div>
  );
}
