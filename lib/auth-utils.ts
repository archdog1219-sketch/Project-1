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
 * Strips sensitive fields before sending user data to the client.
 * contactEmail is only returned if contactEmailVisible is true.
 */
export function sanitizeUser(user: {
  id: string;
  email: string;
  passwordHash: string | null;
  dateOfBirth: Date | null;
  contactEmailVisible: boolean;
  contactEmail: string | null;
  [key: string]: unknown;
}) {
  const { passwordHash, dateOfBirth, email, ...safe } = user;
  return {
    ...safe,
    contactEmail: user.contactEmailVisible ? user.contactEmail : null,
  };
}
