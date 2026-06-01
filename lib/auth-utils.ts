import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Returns session or null. Use in Server Components for optional auth.
 */
export async function getSession() {
  return await auth();
}

/**
 * Returns session or redirects to sign-in. Use in protected Server Components.
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }
  return session;
}

/**
 * Returns true if the given date of birth is 16 or older today.
 */
export function isOldEnough(dateOfBirth: Date): boolean {
  const today = new Date();
  const minAge = new Date(
    today.getFullYear() - 16,
    today.getMonth(),
    today.getDate()
  );
  return dateOfBirth <= minAge;
}

/**
 * Returns only safe, publicly-exposable fields from a user record.
 * Never include: passwordHash, dateOfBirth, email (signup email), or raw session data.
 * contactEmail is only returned if contactEmailVisible is true.
 */
export function sanitizeUser(user: {
  id: string;
  name: string | null;
  username: string | null;
  city: string | null;
  bio: string | null;
  profilePhoto: string | null;
  occupationType: string | null;
  companyName: string | null;
  school: string | null;
  graduationYear: number | null;
  degree: string | null;
  skills: string[];
  interests: string[];
  contactEmail: string | null;
  contactEmailVisible: boolean;
  onboardingComplete: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    city: user.city,
    bio: user.bio,
    profilePhoto: user.profilePhoto,
    occupationType: user.occupationType,
    companyName: user.companyName,
    school: user.school,
    graduationYear: user.graduationYear,
    degree: user.degree,
    skills: user.skills,
    interests: user.interests,
    onboardingComplete: user.onboardingComplete,
    createdAt: user.createdAt,
    contactEmail: user.contactEmailVisible ? user.contactEmail : null,
  };
}
