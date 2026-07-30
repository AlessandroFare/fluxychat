"use client";

import { useState } from "react";
import { Coins, Key, Lock, MessageSquare, CheckCircle2 } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConsoleProjectRoomBar } from "../components/console-project-room-bar";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "@/lib/utils";
import { createWeb3Chat } from "@fluxy-chat/sdk";

const TOUR_STEPS = [
  { id: "wallet", label: "Connect wallet" },
  { id: "room", label: "Token-gated room" },
  { id: "message", label: "On-chain message" },
] as const;

export default function Web3Page() {
  const [w3] = useState(() => createWeb3Chat());
  const [token, setToken] = useState("");
  const [roomId, setRoomId] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Array<{ sender: string; content: string; commitment: string }>>([]);
  const [walletAddr] = useState(() => `0x${Math.random().toString(16).slice(2, 10)}`);
  const [log, setLog] = useState<string[]>([]);
  const [tourStep, setTourStep] = useState(0);

  function addLog(msg: string) { setLog((p) => [msg, ...p]); }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Web3 / Decentralized Chat"
        description="Guided demo: wallet auth → token-gated room → message with on-chain commitment hash."
      />

      <ConsoleProjectRoomBar
        hint="Wallet auth and token-gated rooms run in the SDK demo layer. For production in-app chat, use JWT rooms on your Worker."
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {TOUR_STEPS.map((step, index) => (
          <Badge
            key={step.id}
            variant={index <= tourStep ? "default" : "outline"}
            className={cn(index < tourStep && "bg-emerald-600")}
          >
            {index < tourStep ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}
            {index + 1}. {step.label}
          </Badge>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Panel className={cn("p-4 transition-shadow", tourStep === 0 && "ring-2 ring-primary/30")}>
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Key className="h-4 w-4" /> Wallet</h3>
            <p className="mt-1 text-xs font-mono text-muted-foreground">{walletAddr}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => {
                const t = w3.authWithWallet({ address: walletAddr, chain: "ethereum" });
                setToken(t);
                setTourStep((s) => Math.max(s, 1));
                addLog(`Authenticated: ${t.slice(0, 16)}...`);
              }}>Connect wallet</Button>
              <Button size="sm" variant="outline" onClick={() => {
                const valid = w3.verifyAuth(token, { address: walletAddr, chain: "ethereum" });
                addLog(valid ? "Signature verified ✓" : "Signature invalid ✗");
              }}>Verify auth</Button>
            </div>
          </Panel>

          <Panel className={cn("p-4 transition-shadow", tourStep === 1 && "ring-2 ring-primary/30")}>
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4" /> Token-gated room</h3>
            <div className="mt-3 flex gap-2">
              <Button size="sm" disabled={!token} onClick={() => {
                const room = w3.createRoom("Token Room", [
                  { tokenAddress: "0xABC", chain: "ethereum", minBalance: "1" },
                ]);
                setRoomId(room.id);
                setTourStep((s) => Math.max(s, 2));
                addLog(`Room "${room.id}" created with token gate`);
              }}>Create room</Button>
              <Button size="sm" variant="outline" disabled={!roomId} onClick={() => {
                const ok = w3.joinRoom(roomId, walletAddr);
                addLog(ok ? "Joined room ✓" : "Token gate blocked ✗");
              }}>Join room</Button>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className={cn("p-4 transition-shadow", tourStep === 2 && "ring-2 ring-primary/30")}>
            <h3 className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="h-4 w-4" /> Messages</h3>
            <div className="mt-3 flex gap-2">
              <input
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="Type a message..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || !roomId || !token || !draft.trim()) return;
                  e.preventDefault();
                  const msg = w3.sendMessage(roomId, walletAddr, draft.trim());
                  setMessages((p) => [...p, { sender: msg.sender, content: msg.content, commitment: msg.commitment }]);
                  addLog(`Message sent with commitment: ${msg.commitment.slice(0, 16)}...`);
                  setDraft("");
                  setTourStep(3);
                }}
              />
              <Button size="sm" disabled={!roomId || !token || !draft.trim()} onClick={() => {
                const msg = w3.sendMessage(roomId, walletAddr, draft.trim());
                setMessages((p) => [...p, { sender: msg.sender, content: msg.content, commitment: msg.commitment }]);
                addLog(`Message sent with commitment: ${msg.commitment.slice(0, 16)}...`);
                setDraft("");
                setTourStep(3);
              }}>Send</Button>
            </div>
            {messages.length > 0 ? (
              <div className="mt-3 space-y-2">
                {messages.map((m, i) => (
                  <div key={`${m.commitment}-${i}`} className="rounded-md border border-border bg-muted/20 p-2">
                    <p className="text-xs font-medium">{m.sender.slice(0, 10)}...</p>
                    <p className="text-sm">{m.content}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{m.commitment.slice(0, 20)}...</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">Complete wallet + room steps to send a committed message.</p>
            )}
          </Panel>

          <Panel className="p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Coins className="h-4 w-4" /> Activity</h3>
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {log.map((e, i) => <p key={`${e}-${i}`} className="text-xs text-muted-foreground">{e}</p>)}
            </div>
          </Panel>
        </div>
      </div>
    </ConsoleShell>
  );
}
