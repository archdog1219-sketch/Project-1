import { auth } from "@/lib/auth";

// Admin access is an env-var allow-list, not a DB role: there is exactly one
// reviewer today and a role system would be unused machinery. Fails closed —
// an unset or empty ADMIN_EMAILS grants nobody access.
export function isAdminEmail(
  email: string | null | undefined,
  allowList: string | undefined
): boolean {
  if (!email) return false;
  if (!allowList) return false;
  const allowed = allowList
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
  return allowed.includes(email.trim().toLowerCase());
}

/** True when the current session belongs to an admin. */
export async function requireAdmin(): Promise<boolean> {
  const session = await auth();
  return isAdminEmail(session?.user?.email, process.env.ADMIN_EMAILS);
}
