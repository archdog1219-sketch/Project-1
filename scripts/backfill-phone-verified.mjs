// One-off: existing accounts predate phone verification and must not be locked
// out when the login gate lands. Safe to re-run — it only touches users with
// no phone on file, so genuinely unverified new signups are never affected.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// This project's Prisma client has no default query engine for postgresql —
// lib/db.ts always constructs it with the Neon driver adapter. Mirror that
// here; a bare `new PrismaClient()` throws PrismaClientInitializationError.
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const result = await prisma.user.updateMany({
  where: { phone: null, phoneVerified: false },
  data: { phoneVerified: true },
});

console.log(`Backfilled ${result.count} pre-existing user(s) as phone-verified.`);
await prisma.$disconnect();
