"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AgentRoomChat } from "@/app/components/agent-room-chat";
import { ConsolePanelHeader } from "@/app/components/console-panel-header";
import { Panel } from "@/app/components/ui";
import { useAgentsConsole } from "../../agents-console-context";

export default function AgentChatPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const agentId = params.id;
  const roomFromQuery = searchParams.get("room")?.trim();
  const {
    selectedAgent,
    adminJwt,
    memberJwt,
    memberUserId,
    chatRoomId,
    setChatRoomId,
  } = useAgentsConsole();

  useEffect(() => {
    if (roomFromQuery) setChatRoomId(roomFromQuery);
  }, [roomFromQuery, setChatRoomId]);

  if (!selectedAgent || selectedAgent.id !== agentId) {
    return (
      <Panel className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
        Agent not found or still loading.
      </Panel>
    );
  }

  const roomId = roomFromQuery || chatRoomId;

  return (
    <Panel className="rounded-2xl border border-border/80 p-6">
      <ConsolePanelHeader
        title="Chat with agent"
        description={`Live room chat with ${selectedAgent.name} in ${roomId}. Built-in agents are provisioned when you create a project.`}
        onClose={() => router.push(`/agents/${agentId}`)}
      />
      <AgentRoomChat
        roomId={roomId}
        agentId={selectedAgent.id}
        agentName={selectedAgent.name}
        agentHandle={selectedAgent.handle}
        adminJwt={adminJwt}
        memberJwt={memberJwt}
        memberUserId={memberUserId}
      />
      <p className="mt-4 text-xs text-muted-foreground">
        Deep link:{" "}
        <code className="rounded bg-muted px-1">
          /agents/{agentId}/chat?room={roomId}
        </code>{" "}
        ·{" "}
        <Link href={`/agents/${agentId}`} className="font-medium underline">
          Back to profile
        </Link>
      </p>
    </Panel>
  );
}
