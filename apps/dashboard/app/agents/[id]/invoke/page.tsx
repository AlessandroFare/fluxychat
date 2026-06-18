"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { History } from "lucide-react";
import { AgentRunHistoryRow } from "@/app/components/agent-run-history-row";
import { ConsolePanelHeader } from "@/app/components/console-panel-header";
import { RoomPicker } from "@/app/components/room-picker";
import { Button, Input, Panel, SkeletonCard } from "@/app/components/ui";
import { useAgentsConsole } from "../../agents-console-context";

export default function AgentInvokePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const agentId = params.id;
  const {
    selectedAgent,
    sessionToken,
    invokeRoomId,
    setInvokeRoomId,
    invokeText,
    setInvokeText,
    invoking,
    invokeAgent,
    runs,
    loadingRuns,
    loadRuns,
    openAgentChat,
    preparingChat,
  } = useAgentsConsole();

  useEffect(() => {
    if (agentId) void loadRuns(agentId);
  }, [agentId, loadRuns]);

  if (!selectedAgent || selectedAgent.id !== agentId) {
    return (
      <Panel className="rounded-2xl border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
        Agent not found or still loading.
      </Panel>
    );
  }

  return (
    <Panel className="rounded-2xl border border-border/80 p-6">
      <ConsolePanelHeader
        title="Test invoke"
        description={`Send a message as ${selectedAgent.name} into a room.`}
        onClose={() => router.push(`/agents/${agentId}`)}
      />
      <p className="mb-4 text-xs text-muted-foreground">
        One-shot REST invoke. For live streaming, tools in-thread, and run feedback use{" "}
        <button
          type="button"
          className="font-medium text-brand underline underline-offset-2"
          onClick={() => void openAgentChat(agentId)}
          disabled={preparingChat}
        >
          Chat in room
        </button>
        .
      </p>
      <div className="mb-6 grid gap-2 sm:grid-cols-[minmax(160px,220px)_1fr_auto] sm:items-end">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Room</p>
          <RoomPicker
            token={sessionToken}
            value={invokeRoomId}
            onChange={setInvokeRoomId}
            placeholder="Select room"
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Message</p>
          <Input
            value={invokeText}
            onChange={(e) => setInvokeText(e.target.value)}
            placeholder="Hello from the dashboard…"
          />
        </div>
        <Button
          className="bg-brand text-white hover:bg-[#e8614d] sm:mb-0"
          onClick={() => void invokeAgent(agentId)}
          disabled={invoking || !invokeRoomId.trim() || !invokeText.trim()}
        >
          {invoking ? "Invoking…" : "Invoke"}
        </Button>
      </div>

      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <History className="h-4 w-4" />
        Run history
      </h3>
      {loadingRuns ? (
        <SkeletonCard />
      ) : runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No runs yet for this agent.</p>
      ) : (
        <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto">
          {runs.map((run) => (
            <AgentRunHistoryRow key={run.id} run={run as unknown as Record<string, unknown>} />
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        <Link href={`/agents/${agentId}`} className="font-medium underline">
          Back to profile
        </Link>
      </p>
    </Panel>
  );
}
