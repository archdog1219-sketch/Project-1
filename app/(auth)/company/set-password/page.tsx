import SetPasswordForm from "./set-password-form";

export default async function CompanySetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", marginBottom: "6px" }}>
          Link not valid
        </div>
        <p style={{ fontSize: "12px", color: "#666" }}>
          This link is missing its token. Use the link from your approval email.
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ fontSize: "18px", fontWeight: "bold", color: "#3b5998", marginBottom: "4px" }}>
        Set your password
      </div>
      <p style={{ fontSize: "11px", color: "#666", margin: "0 0 14px" }}>
        Your company is approved. Choose a password to finish setting up your account.
      </p>
      <SetPasswordForm token={token} />
    </div>
  );
}
