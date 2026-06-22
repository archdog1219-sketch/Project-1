import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Returns the signed-in user's id if they are an EMPLOYER account, else null.
// Used by employer-only pages/routes/nav to gate access.
export async function getEmployerUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { occupationType: true },
  });
  return user?.occupationType === "EMPLOYER" ? session.user.id : null;
}
