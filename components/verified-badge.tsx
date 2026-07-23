export default function VerifiedBadge({ size = 10 }: { size?: number }) {
  return (
    <span
      title="Identity verified"
      style={{ background: "#e8f0fe", color: "#1a56b0", border: "1px solid #b7cdf1", borderRadius: "2px", padding: "0 5px", fontSize: `${size}px`, fontWeight: "bold", whiteSpace: "nowrap" }}
    >
      ✓ Verified
    </span>
  );
}
