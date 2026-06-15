import { LISTINGS, TYPE_LABELS } from "@/lib/listings";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return LISTINGS.map((l) => ({ id: String(l.id) }));
}

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = LISTINGS.find((l) => l.id === Number(id));
  if (!listing) notFound();

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "16px", fontFamily: "Arial, Helvetica, sans-serif" }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: "11px", color: "#666", marginBottom: "12px" }}>
        <Link href="/" style={{ color: "#3b5998", textDecoration: "none" }}>Home</Link>
        {" › "}
        <Link href="/browse" style={{ color: "#3b5998", textDecoration: "none" }}>Browse</Link>
        {" › "}
        <span>{listing.title}</span>
      </div>

      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ border: "1px solid #c8d0e0", borderRadius: "3px", background: "#fff" }}>
            {/* Header */}
            <div style={{ background: "#e8edf5", borderBottom: "1px solid #c8d0e0", padding: "12px 16px" }}>
              <h1 style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", margin: 0 }}>{listing.title}</h1>
              <div style={{ fontSize: "13px", color: "#333", marginTop: "3px" }}>{listing.org} &nbsp;·&nbsp; {listing.location}</div>
            </div>

            {/* Tags */}
            <div style={{ padding: "10px 16px", borderBottom: "1px solid #e8edf5", display: "flex", gap: "5px", flexWrap: "wrap" }}>
              <span style={{ background: "#d8dfea", color: "#3b5998", borderRadius: "2px", padding: "2px 7px", fontSize: "11px", fontWeight: "bold" }}>
                {TYPE_LABELS[listing.type]}
              </span>
              {listing.tags.map((tag) => (
                <span key={tag} style={{ background: "#f0f0f0", color: "#555", borderRadius: "2px", padding: "2px 7px", fontSize: "11px" }}>
                  {tag}
                </span>
              ))}
            </div>

            {/* Description */}
            <div style={{ padding: "16px" }}>
              <h2 style={{ fontSize: "13px", fontWeight: "bold", color: "#333", marginBottom: "8px", marginTop: 0 }}>About this opportunity</h2>
              <p style={{ fontSize: "13px", color: "#333", lineHeight: "1.6", margin: 0 }}>{listing.description}</p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ width: "200px", flexShrink: 0 }}>
          <div style={{ border: "1px solid #c8d0e0", borderRadius: "3px", background: "#fff", marginBottom: "10px" }}>
            <div style={{ background: "#e8edf5", borderBottom: "1px solid #c8d0e0", padding: "8px 12px", fontSize: "12px", fontWeight: "bold", color: "#3b5998" }}>
              Details
            </div>
            <div style={{ padding: "10px 12px" }}>
              <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ color: "#666", paddingBottom: "6px", paddingRight: "8px", verticalAlign: "top" }}>Type</td>
                    <td style={{ color: "#333", paddingBottom: "6px", fontWeight: "bold" }}>{listing.type}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "#666", paddingBottom: "6px", paddingRight: "8px", verticalAlign: "top" }}>Location</td>
                    <td style={{ color: "#333", paddingBottom: "6px" }}>{listing.location}</td>
                  </tr>
                  {listing.deadline && (
                    <tr>
                      <td style={{ color: "#666", paddingBottom: "6px", paddingRight: "8px", verticalAlign: "top" }}>Deadline</td>
                      <td style={{ color: "#c00", paddingBottom: "6px", fontWeight: "bold" }}>{listing.deadline}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <a
            href={listing.applyUrl ?? "#"}
            style={{ display: "block", width: "100%", boxSizing: "border-box", background: "#3b5998", color: "#fff", border: "1px solid #29487d", padding: "7px 0", fontSize: "13px", fontWeight: "bold", borderRadius: "2px", cursor: "pointer", textAlign: "center", textDecoration: "none" }}
          >
            Apply Now
          </a>

          <div style={{ marginTop: "8px", fontSize: "11px", color: "#999", textAlign: "center" }}>
            <a href="/sign-up" style={{ color: "#3b5998" }}>Sign up</a> to save this opportunity
          </div>
        </div>
      </div>

      {/* Back link */}
      <div style={{ marginTop: "14px", fontSize: "12px" }}>
        <Link href="/browse" style={{ color: "#3b5998", textDecoration: "underline" }}>← Back to browse</Link>
      </div>
    </div>
  );
}
