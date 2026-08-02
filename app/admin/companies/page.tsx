import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import AdminClient from "./admin-client";

export default async function AdminCompaniesPage() {
  // 404 rather than redirect: a non-admin should not learn this page exists.
  if (!(await requireAdmin())) notFound();

  const applications = await db.companyApplication.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      companyName: true,
      contactName: true,
      workEmail: true,
      website: true,
      description: true,
      status: true,
      createdAt: true,
      decidedAt: true,
    },
  });

  return (
    <AdminClient
      applications={applications.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        decidedAt: a.decidedAt?.toISOString() ?? null,
      }))}
    />
  );
}
