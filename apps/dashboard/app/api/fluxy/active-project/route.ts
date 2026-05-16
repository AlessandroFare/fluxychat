import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { syncFluxyProjectToClerk } from "@/lib/clerk-fluxy-metadata";
import { isClerkEnabled } from "@/lib/clerk-config";

export async function POST(request: Request) {
  if (!isClerkEnabled()) {
    return NextResponse.json({ ok: true, clerk: false });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string;
    projectName?: string;
  };

  if (!body.projectId?.trim() || !body.projectName?.trim()) {
    return NextResponse.json({ error: "projectId and projectName required" }, { status: 400 });
  }

  await syncFluxyProjectToClerk(userId, {
    id: body.projectId.trim(),
    name: body.projectName.trim(),
  });

  return NextResponse.json({ ok: true });
}
