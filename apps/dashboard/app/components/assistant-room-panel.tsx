"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Loader2 } from "lucide-react";
import { useClerkUser } from "@/lib/clerk-user";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";
import {
  ASSISTANT_ROOM_DISPLAY_NAME,
  ASSISTANT_ROOM_ID,
  pickDefaultAssistantAgent,
} from "@/lib/assistant-room";
import { ensureAssistantRoom } from "@/lib/ensure-assistant-room";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { messageFromUnknown } from "@/lib/error-message";
import { AgentRoomChat } from "./agent-room-chat";
import { Banner, Button, Section } from "./ui";

const WORKER_URL = getPublicWorkerUrl();

interface AgentRow {
  id: string;
  name: string;
  handle?: string | null;
}

export interface AssistantRoomPanelProps {
  memberJwt: string;
  adminJwt?: string;
}

/** Ensures `assistant:general` and embeds agent chat (Rooms page CTA). */
export function AssistantRoomPanel({ memberJwt, adminJwt = "" }: AssistantRoomPanelProps) {
  const { user: clerkUser } = useClerkUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [agent, setAgent] = useState<AgentRow | null>(null);

  const memberUserId = clerkUser?.id ? fluxyUserIdFromClerk(clerkUser.id) : "dashboard";

  const bootstrap = useCallback(async () => {
    const token = memberJwt.trim();
    if (!token) {
      setError("Member JWT required (Quickstart or Projects).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureAssistantRoom({
        workerUrl: WORKER_URL,
        memberJwt: token,
        memberUserId,
      });
      const adminToken = adminJwt.trim() || token;
      const json = await fetchWorkerJson<{ agents?: AgentRow[] }>(
        `${WORKER_URL}/agents`,
        { headers: { Authorization: `Bearer ${adminToken}` } },
      );
      const picked = pickDefaultAssistantAgent(json.agents ?? []);
      if (!picked) {
        setError("No agents in project. Create one on the Agents page.");
        setReady(false);
        return;
      }
      setAgent({ id: picked.id, name: picked.name, handle: picked.handle });
      setReady(true);
    } catch (e: unknown) {
      setError(messageFromUnknown(e, "Could not open assistant room"));
      setReady(false);
    } finally {
      setBusy(false);
    }
  }, [memberJwt, adminJwt, memberUserId]);

  useEffect(() => {
    if (!memberJwt.trim()) return;
    void bootstrap();
  }, [memberJwt, bootstrap]);

  return (
    <Section
      title="Assistant room"
      description={`Default AI room (${ASSISTANT_ROOM_DISPLAY_NAME}). Same flow as Agents → Chat in room.`}
    >
      {error ? <Banner variant="error">{error}</Banner> : null}
      {!ready ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => void bootstrap()} disabled={busy || !memberJwt.trim()}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Opening…
              </>
            ) : (
              <>
                <Bot className="h-4 w-4" aria-hidden />
                Open assistant chat
              </>
            )}
          </Button>
          <Link href="/agents" className="text-sm text-brand hover:underline">
            Configure agents →
          </Link>
        </div>
      ) : agent ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Room <code className="font-mono">{ASSISTANT_ROOM_ID}</code> · agent{" "}
            <span className="font-medium text-foreground">{agent.name}</span>
            {agent.handle ? (
              <>
                {" "}
                (<code>@{agent.handle.replace(/^@/, "")}</code>)
              </>
            ) : null}
          </p>
          <AgentRoomChat
            roomId={ASSISTANT_ROOM_ID}
            agentId={agent.id}
            agentName={agent.name}
            agentHandle={agent.handle}
            adminJwt={adminJwt}
          />
          <Link href="/agents" className="text-xs text-brand hover:underline">
            Full agent console →
          </Link>
        </div>
      ) : null}
    </Section>
  );
}
