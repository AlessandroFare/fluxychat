import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isClerkEnabled } from "@/lib/clerk-config";
import { provisionFluxyForClerkUser } from "@/lib/fluxy-provision";
import { getConsoleApiKey } from "@/lib/fluxy-server";
import { messageFromUnknown } from "@/lib/error-message";

/**
 * POST /api/fluxy/connect
 * Hosted provisioning after Clerk sign-in: mint tenant admin JWT, create project on first visit.
 */
export async function POST(request: Request) {
  if (!isClerkEnabled()) {
    return NextResponse.json(
      { error: "Clerk is not configured. Paste an admin JWT in Setup instead." },
      { status: 503 },
    );
  }

  if (!getConsoleApiKey()) {
    return NextResponse.json(
      {
        error:
          "Server missing FLUXY_CONSOLE_API_KEY (bootstrap key on the hosted Worker). See apps/dashboard/.env.example.",
      },
      { status: 503 },
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const user = await currentUser();
  const body = (await request.json().catch(() => ({}))) as {
    createProject?: boolean;
    projectName?: string;
  };

  try {
    const result = await provisionFluxyForClerkUser(userId, user, {
      createProject: body.createProject,
      projectName: body.projectName,
    });

    const activeProject = result.activeProject
      ? {
          id: result.activeProject.id,
          name: result.activeProject.name,
          created_at: result.activeProject.created_at,
          ...(result.createdNewProject && result.activeProject.apiKey
            ? { apiKey: result.activeProject.apiKey }
            : {}),
        }
      : null;

    return NextResponse.json({
      adminJwt: result.adminJwt,
      expiresIn: result.expiresIn,
      projectId: result.projectId,
      activeProject,
      createdNewProject: result.createdNewProject,
      clerkUserId: userId,
    });
  } catch (err: unknown) {
    const message = messageFromUnknown(err, "Connect failed");
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
