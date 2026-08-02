export default function CompanyApplicationSubmittedPage() {
  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif", textAlign: "center" }}>
      <div style={{ fontSize: "40px", marginBottom: "10px" }}>📨</div>
      <div style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", marginBottom: "6px" }}>
        Application received
      </div>
      <p style={{ fontSize: "12px", color: "#666", margin: "0 0 4px" }}>
        We review every company by hand. You&apos;ll get an email at the address
        you gave us once we&apos;ve had a look.
      </p>
      <p style={{ fontSize: "11px", color: "#999", margin: "0 0 16px" }}>
        Approved companies get a link to set a password and start posting.
      </p>
      <a href="/" style={{ fontSize: "12px", color: "#3b5998" }}>Back to home</a>
    </div>
  );
}
