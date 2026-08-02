import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<void> {
  const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`;

  await getResend().emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: "Verify your email address",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Verify your email</h2>
        <p>Click the button below to verify your email address. This link expires in 24 hours.</p>
        <a href="${verifyUrl}"
           style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">
          Verify Email
        </a>
        <p style="color:#64748b;font-size:14px;margin-top:16px;">
          If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

export async function sendCompanyApplicationNotification(
  adminEmail: string,
  application: {
    id: string;
    companyName: string;
    contactName: string;
    workEmail: string;
    website: string | null;
    description: string | null;
  }
): Promise<void> {
  const reviewUrl = `${process.env.NEXTAUTH_URL}/admin/companies`;

  await getResend().emails.send({
    from: process.env.EMAIL_FROM!,
    to: adminEmail,
    subject: `New company application: ${application.companyName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
        <h2>New company application</h2>
        <p><strong>Company:</strong> ${application.companyName}</p>
        <p><strong>Contact:</strong> ${application.contactName} &lt;${application.workEmail}&gt;</p>
        <p><strong>Website:</strong> ${application.website ?? "—"}</p>
        <p><strong>What they're hiring for:</strong><br/>${application.description ?? "—"}</p>
        <a href="${reviewUrl}"
           style="display:inline-block;padding:12px 24px;background:#3b5998;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">
          Review applications
        </a>
      </div>
    `,
  });
}
