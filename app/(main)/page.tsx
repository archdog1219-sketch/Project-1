import { getAllOpportunities } from "@/lib/opportunities";
import HomeClient from "./home-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const listings = await getAllOpportunities();
  return <HomeClient listings={listings} />;
}
