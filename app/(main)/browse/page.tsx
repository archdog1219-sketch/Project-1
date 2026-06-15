import { getAllOpportunities } from "@/lib/opportunities";
import BrowseClient from "./browse-client";

export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  const listings = await getAllOpportunities();
  return <BrowseClient listings={listings} />;
}
