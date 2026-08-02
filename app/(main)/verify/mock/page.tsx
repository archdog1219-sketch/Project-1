import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { isIdentityMockEnabled } from "@/lib/identity";
import MockForm from "./mock-form";

export const dynamic = "force-dynamic";

export default async function VerifyMockPage() {
  // Never reachable in production: the mock would hand out a real badge.
  if (!isIdentityMockEnabled()) notFound();

  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/verify");

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif", maxWidth: "560px", margin: "0 auto", padding: "12px 16px" }}>
      <div style={{ fontSize: "13px", fontWeight: "bold", color: "#3b5998", marginBottom: "10px" }}>
        Identity check — DEV MOCK
      </div>

      <div style={{ background: "#fff8e1", border: "1px solid #e0c36a", color: "#7a5d00", fontSize: "11px", padding: "8px 10px", borderRadius: "2px", marginBottom: "12px" }}>
        This simulates the Persona / Stripe Identity flow. No real vendor is configured
        (IDV_PROVIDER=mock).
      </div>

      <div style={{ background: "#fff", border: "1px solid #c8d0e0", borderRadius: "3px", padding: "12px 14px" }}>
        <MockForm />
      </div>
    </div>
  );
}
