import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ensureAssistantRoom } from "@/lib/ensure-assistant-room";
import { markQuickstartComplete } from "@/lib/quickstart-progress";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import type { CreatedRoom } from "./onboarding-shared";

const WORKER_URL = getPublicWorkerUrl();

export async function finishQuickstartAndOpenConsole(
  router: AppRouterInstance,
  args: {
    clerkUserId: string;
    memberJwt: string;
    memberUserId: string;
    projectId: string;
    setLastRoom: (room: CreatedRoom) => void;
  },
  destination = "/",
) {
  markQuickstartComplete(args.clerkUserId);
  if (args.memberJwt.trim() && args.memberUserId.trim()) {
    try {
      const { room } = await ensureAssistantRoom({
        workerUrl: WORKER_URL,
        memberJwt: args.memberJwt.trim(),
        memberUserId: args.memberUserId.trim(),
        projectId: args.projectId,
      });
      args.setLastRoom({
        id: room.id,
        type: room.type,
        name: room.name,
        created_at: room.created_at,
      });
    } catch {
      // Non-blocking: user may already have a room from step 3.
    }
  }
  router.push(destination);
}
