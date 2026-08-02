import { db } from "@/lib/db";
import { isPhoneOtpMockEnabled } from "@/lib/phone-otp";
import VerifyPhoneForm from "./verify-phone-form";
import EmailPrompt from "./email-prompt";

export default async function VerifyPhonePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const isMock = isPhoneOtpMockEnabled();

  let mockCode: string | null = null;
  if (isMock && email) {
    const user = await db.user.findUnique({
      where: { email },
      select: { phoneOtpCode: true },
    });
    mockCode = user?.phoneOtpCode ?? null;
  }

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", marginBottom: "4px" }}>
        Confirm your phone
      </div>
      <p style={{ fontSize: "11px", color: "#666", margin: "0 0 14px" }}>
        Enter the 6-digit code we sent you. It expires in 10 minutes.
      </p>

      {isMock && (
        <div style={{ background: "#fff8e1", border: "1px solid #ffb300", borderRadius: "2px", padding: "8px 10px", marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: "bold", color: "#7a5c00", marginBottom: "3px" }}>
            DEV MOCK — no text message was sent
          </div>
          <div style={{ fontSize: "11px", color: "#7a5c00" }}>
            {mockCode
              ? <>Your code is <strong style={{ fontSize: "14px", letterSpacing: "1px" }}>{mockCode}</strong>. Anyone who knows this email address can see it — this stand-in must be replaced with real SMS before launch.</>
              : <>No pending code for this address.</>}
          </div>
        </div>
      )}

      {email ? (
        <VerifyPhoneForm email={email} />
      ) : (
        <EmailPrompt />
      )}
    </div>
  );
}
