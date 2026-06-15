import { OccupationType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAllOpportunities } from "@/lib/opportunities";
import { rankForUser, type MatchProfile } from "@/lib/matching";
import HomeClient from "./home-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  const all = await getAllOpportunities();

  let forYou = all.map((o) => ({ opportunity: o, score: 0, reason: "" }));
  let signedIn = false;
  let profileSummary: string | null = null;

  if (session?.user?.id) {
    signedIn = true;
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { schoolLevel: true, graduationYear: true, city: true, interests: true, occupationType: true },
    });
    if (user) {
      const gradeLabel = gradeLabelFor(user);
      const profile: MatchProfile = {
        gradeLabel,
        location: user.city ?? null,
        interests: user.interests ?? [],
      };
      forYou = rankForUser(profile, all);
      const parts = [gradeLabel, user.city, (user.interests ?? []).slice(0, 3).join(", ")].filter(Boolean);
      profileSummary = parts.length ? parts.join(" · ") : null;
    }
  }

  return <HomeClient all={all} forYou={forYou} signedIn={signedIn} profileSummary={profileSummary} />;
}

// Maps stored education info to the grade label the scorer expects.
function gradeLabelFor(u: {
  schoolLevel: string | null;
  graduationYear: number | null;
  occupationType: OccupationType | null;
}): string | null {
  if (u.occupationType === "STUDENT_COLLEGE" || u.schoolLevel === "College") return "College";
  if (u.graduationYear != null) {
    const yearsLeft = u.graduationYear - new Date().getFullYear();
    const grade = 12 - yearsLeft;
    if (grade >= 9 && grade <= 12) return `Grade ${grade}`;
  }
  if (u.schoolLevel === "High School" || u.occupationType === "STUDENT_HS") return "Grade 12";
  return null;
}
