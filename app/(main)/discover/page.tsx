import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getSwipeDeck } from "@/lib/discover";
import SwipeDeck from "./swipe-deck";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/discover");

  const { deck, hasMatchingProfile } = await getSwipeDeck(session.user.id);

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif", maxWidth: "480px", margin: "0 auto", padding: "16px" }}>
      <div style={{ textAlign: "center", fontSize: "15px", fontWeight: "bold", color: "#3b5998", marginBottom: "3px" }}>Discover</div>
      <div style={{ textAlign: "center", fontSize: "11px", color: "#666", marginBottom: "12px" }}>
        Swipe <b>left to save</b>, <b>right to skip</b> — or use the buttons below.
      </div>
      {!hasMatchingProfile && (
        <div style={{ fontSize: "11px", color: "#666", background: "#e8edf5", border: "1px solid #c8d0e0", borderRadius: "3px", padding: "7px 10px", marginBottom: "10px", textAlign: "center" }}>
          <Link href="/onboarding/matching" style={{ color: "#3b5998" }}>Add your interests</Link> to get better recommendations.
        </div>
      )}
      <SwipeDeck initialDeck={deck} />
    </div>
  );
}
