import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getVerification, isIdentityMockEnabled } from "@/lib/identity";
import StartButton from "./start-button";

export const dynamic = "force-dynamic";

const box: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #c8d0e0",
  borderRadius: "3px",
  padding: "12px 14px",
  marginBottom: "12px",
};

export default async function VerifyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/verify");

  const verification = await getVerification(session.user.id);
  const isVerified = verification?.status === "VERIFIED";
  const canVerify = isIdentityMockEnabled();

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif", maxWidth: "560px", margin: "0 auto", padding: "12px 16px" }}>
      <div style={{ fontSize: "13px", fontWeight: "bold", color: "#3b5998", marginBottom: "10px" }}>
        Identity verification
      </div>

      {isVerified ? (
        <div style={{ ...box, background: "#e8f5e9", border: "1px solid #2e7d32", color: "#2e7d32" }}>
          <div style={{ fontSize: "13px", fontWeight: "bold", marginBottom: "4px" }}>✓ You&apos;re verified</div>
          <div style={{ fontSize: "12px" }}>
            Your profile now shows the verified badge, and you get a boost in rankings
            {verification?.issuingCountry ? ` (ID issued in ${verification.issuingCountry})` : ""}.
          </div>
        </div>
      ) : (
        <>
          {verification?.status === "FAILED" && (
            <div style={{ ...box, background: "#fff3f3", border: "1px solid #f5c6cb", color: "#c00" }}>
              <span style={{ fontSize: "12px" }}>
                <b>Last attempt failed:</b> {verification.failureReason ?? "Verification failed"}
              </span>
            </div>
          )}

          <div style={box}>
            <div style={{ fontSize: "12px", fontWeight: "bold", color: "#333", marginBottom: "6px" }}>
              What verification gets you
            </div>
            <ul style={{ fontSize: "12px", color: "#333", margin: 0, paddingLeft: "18px", lineHeight: "1.7" }}>
              <li>✓ Verified badge on your profile, posts, and activity</li>
              <li>Higher ranking in &quot;students with similar interests&quot;</li>
              <li>Verified-poster mark and a match boost when you post opportunities</li>
            </ul>
          </div>

          <div style={box}>
            <div style={{ fontSize: "12px", fontWeight: "bold", color: "#333", marginBottom: "6px" }}>
              How it works
            </div>
            <ul style={{ fontSize: "12px", color: "#333", margin: 0, paddingLeft: "18px", lineHeight: "1.7" }}>
              <li>You&apos;ll be asked for a government ID and a quick selfie.</li>
              <li>
                The name on your ID must match your profile name — that&apos;s the point: it makes
                your real name real.
              </li>
              <li>We store only a verification record, never your ID image or number.</li>
            </ul>
            <div style={{ fontSize: "11px", color: "#666", marginTop: "8px" }}>
              ID checks are for adults (18+). Verification is optional — unverified accounts keep
              full access.
            </div>
          </div>

          {canVerify ? (
            <StartButton />
          ) : (
            <div style={{ ...box, background: "#f7f9fc" }}>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "#333", marginBottom: "4px" }}>
                Not available yet
              </div>
              <div style={{ fontSize: "12px", color: "#555" }}>
                We&apos;re still setting up our ID-check provider. Verification will open
                up here once it&apos;s ready — nothing is required of you in the meantime,
                and your account keeps full access.
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ fontSize: "11px", marginTop: "12px" }}>
        <Link href={`/profile/${session.user.id}`} style={{ color: "#3b5998" }}>
          « Back to my profile
        </Link>
      </div>
    </div>
  );
}
