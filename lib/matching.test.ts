import { describe, it, expect } from "vitest";
import { scoreOpportunity, rankForUser, type MatchProfile } from "./matching";
import type { OpportunityView } from "./opportunities";

const profile: MatchProfile = {
  gradeLabel: "Grade 11",
  location: "New York, NY",
  interests: ["Technology", "Science"],
};

function opp(over: Partial<OpportunityView>): OpportunityView {
  return {
    id: "x", title: "T", org: "O", type: "Internships", location: "Remote",
    description: "", tags: [], deadline: null, applyUrl: null,
    targetGrades: ["Grade 11"], targetInterests: ["Technology"], isPaid: false, ...over,
  };
}

describe("scoreOpportunity", () => {
  it("gives interest-overlap points and reports the interest reason", () => {
    const r = scoreOpportunity(profile, opp({ targetInterests: ["Technology", "Science"], targetGrades: [] }));
    expect(r.score).toBeGreaterThan(0);
    expect(r.reason).toBe("Matches your interests");
  });

  it("reports grade eligibility when the grade matches and interests do not", () => {
    const r = scoreOpportunity(profile, opp({ targetInterests: ["Law"], targetGrades: ["Grade 11"] }));
    expect(r.score).toBeGreaterThan(0);
    expect(r.reason).toBe("Grade 11 eligible");
  });

  it("treats empty targetGrades as open to all grades", () => {
    const r = scoreOpportunity(profile, opp({ targetGrades: [], targetInterests: ["Law"] }));
    expect(r.reason).toBe("Open to all grades");
    expect(r.score).toBeGreaterThan(0);
  });

  it("gives a location point and reason for Remote", () => {
    const r = scoreOpportunity(
      { ...profile, interests: [] },
      opp({ location: "Remote", targetGrades: [], targetInterests: [] })
    );
    expect(r.reason).toBe("Remote-friendly");
  });

  it("matches interests case-insensitively", () => {
    const r = scoreOpportunity(
      { gradeLabel: "Grade 11", location: "Remote", interests: ["technology"] },
      opp({ targetInterests: ["Technology"], targetGrades: [] })
    );
    expect(r.reason).toBe("Matches your interests");
    expect(r.score).toBeGreaterThan(0);
  });

  it("scores higher when more signals match", () => {
    const strong = scoreOpportunity(profile, opp({ targetInterests: ["Technology", "Science"], targetGrades: ["Grade 11"], location: "New York, NY" }));
    const weak = scoreOpportunity(profile, opp({ targetInterests: ["Law"], targetGrades: ["College"], location: "Boston, MA" }));
    expect(strong.score).toBeGreaterThan(weak.score);
  });
});

describe("rankForUser", () => {
  it("sorts opportunities by descending score", () => {
    const ranked = rankForUser(profile, [
      opp({ id: "weak", targetInterests: ["Law"], targetGrades: ["College"], location: "Boston, MA" }),
      opp({ id: "strong", targetInterests: ["Technology"], targetGrades: ["Grade 11"], location: "New York, NY" }),
    ]);
    expect(ranked[0].opportunity.id).toBe("strong");
  });
});
