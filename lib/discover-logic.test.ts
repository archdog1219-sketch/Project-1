import { describe, it, expect } from "vitest";
import { buildDeck, DEFAULT_DECK_SIZE } from "./discover-logic";
import type { MatchProfile } from "./matching";
import type { OpportunityView } from "./opportunities";

const profile: MatchProfile = {
  gradeLabel: "Grade 11",
  location: "New York, NY",
  interests: ["Technology"],
};

function opp(id: string, over: Partial<OpportunityView> = {}): OpportunityView {
  return {
    id, title: "T", org: "O", type: "Internships", location: "Remote",
    description: "", tags: [], deadline: null, applyUrl: null,
    targetGrades: [], targetInterests: [], isPaid: false, ...over,
  };
}

describe("buildDeck", () => {
  it("excludes opportunities the user has already acted on", () => {
    const deck = buildDeck(profile, [opp("a"), opp("b"), opp("c")], new Set(["b"]));
    expect(deck.map((d) => d.opportunity.id).sort()).toEqual(["a", "c"]);
  });

  it("ranks the deck best-match-first", () => {
    const deck = buildDeck(profile, [
      opp("weak", { targetInterests: ["Law"], targetGrades: ["College"], location: "Boston, MA" }),
      opp("strong", { targetInterests: ["Technology"], targetGrades: ["Grade 11"], location: "New York, NY" }),
    ], new Set());
    expect(deck[0].opportunity.id).toBe("strong");
  });

  it("caps the deck at the limit", () => {
    const many = Array.from({ length: 30 }, (_, i) => opp(`o${i}`));
    expect(buildDeck(profile, many, new Set()).length).toBe(DEFAULT_DECK_SIZE);
    expect(buildDeck(profile, many, new Set(), 5).length).toBe(5);
  });

  it("returns an empty deck when everything is excluded", () => {
    const deck = buildDeck(profile, [opp("a")], new Set(["a"]));
    expect(deck).toEqual([]);
  });

  it("still deals cards for an empty profile (all score 0)", () => {
    const deck = buildDeck({ gradeLabel: null, location: null, interests: [] }, [opp("a", { targetGrades: ["Grade 11"] })], new Set());
    expect(deck.length).toBe(1);
  });
});
