import type { OpportunityView } from "./opportunities";

export interface MatchProfile {
  gradeLabel: string | null;
  location: string | null;
  interests: string[];
}

export interface ScoredOpportunity {
  opportunity: OpportunityView;
  score: number;
  reason: string;
}

const INTEREST_WEIGHT = 3;
const GRADE_WEIGHT = 2;
const LOCATION_WEIGHT = 1;

export function scoreOpportunity(profile: MatchProfile, o: OpportunityView): ScoredOpportunity {
  let score = 0;

  const profileInterestsLower = profile.interests.map((i) => i.toLowerCase());
  const overlap = o.targetInterests.filter((t) => profileInterestsLower.includes(t.toLowerCase()));
  score += overlap.length * INTEREST_WEIGHT;

  const gradeOpen = o.targetGrades.length === 0;
  const gradeMatch =
    profile.gradeLabel != null &&
    o.targetGrades.some((g) => g.toLowerCase() === profile.gradeLabel!.toLowerCase());
  if (gradeOpen || gradeMatch) score += GRADE_WEIGHT;

  const remote = o.location.toLowerCase().includes("remote");
  const sameLocation =
    profile.location != null && o.location.toLowerCase() === profile.location.toLowerCase();
  if (remote || sameLocation) score += LOCATION_WEIGHT;

  let reason = "";
  if (overlap.length > 0) reason = "Matches your interests";
  else if (gradeMatch) reason = `${profile.gradeLabel} eligible`;
  else if (gradeOpen && profile.interests.length > 0) reason = "Open to all grades";
  else if (remote) reason = "Remote-friendly";
  else if (sameLocation) reason = "Near you";
  else if (gradeOpen) reason = "Open to all grades";

  return { opportunity: o, score, reason };
}

export function rankForUser(profile: MatchProfile, opportunities: OpportunityView[]): ScoredOpportunity[] {
  return opportunities
    .map((o) => scoreOpportunity(profile, o))
    .sort((a, b) => b.score - a.score);
}

// Maps stored education info to the grade label the scorer expects
// ("College", "Grade 9".."Grade 12", or null). currentYear is injectable for tests.
export function gradeLabelFor(
  u: { schoolLevel: string | null; graduationYear: number | null; occupationType: string | null },
  currentYear: number = new Date().getFullYear()
): string | null {
  if (u.occupationType === "STUDENT_COLLEGE" || u.schoolLevel === "College") return "College";
  if (u.graduationYear != null) {
    const grade = 12 - (u.graduationYear - currentYear);
    if (grade >= 9 && grade <= 12) return `Grade ${grade}`;
  }
  if (u.schoolLevel === "High School" || u.occupationType === "STUDENT_HS") return "Grade 12";
  return null;
}
