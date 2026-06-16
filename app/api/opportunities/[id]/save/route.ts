import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saveStatusSchema } from "@/lib/validations";
import { setSaveStatus } from "@/lib/social";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = saveStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const status = await setSaveStatus(session.user.id, id, parsed.data.status);
  return NextResponse.json({ status });
}
