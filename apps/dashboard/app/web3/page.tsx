"use client";

import { useState } from "react";
import { Coins, Key, Lock, MessageSquare, Users } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";
import { createWeb3Chat } from "@fluxy-chat/sdk";

export default function Web3Page() {
  const [w3] = useState(() => createWeb3Chat());
  const [token, setToken] = useState("");
  const [roomId, setRoomId] = useState("");
  const [messages, setMessages] = useState<Array<{ sender: string; content: string; commitment: string }>>([]);
  const [walletAddr] = useState(() => `0x${Math.random().toString(16).slice(2, 10)}`);
  const [log, setLog] = useState<string[]>([]);

  function addLog(msg: string) { setLog((p) => [msg, ...p]); }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Web3 / Decentralized Chat"
        description="Wallet-based auth, token-gated rooms, on-chain message commitments — SDK-powered demo."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Panel className="p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Key className="h-4 w-4" /> Wallet</h3>
            <p className="mt-1 text-xs font-mono text-muted-foreground">{walletAddr}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => {
                const t = w3.authWithWallet({ address: walletAddr, chain: "ethereum" });
                setToken(t);
                addLog(`Authenticated: ${t.slice(0, 16)}...`);
              }}>Connect wallet</Button>
              <Button size="sm" variant="outline" onClick={() => {
                const valid = w3.verifyAuth(token, { address: walletAddr, chain: "ethereum" });
                addLog(valid ? "Signature verified ✓" : "Signature invalid ✗");
              }}>Verify auth</Button>
            </div>
          </Panel>

          <Panel className="p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4" /> Token-gated room</h3>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => {
                const room = w3.createRoom("Token Room", [
                  { tokenAddress: "0xABC", chain: "ethereum", minBalance: "1" },
                ]);
                setRoomId(room.id);
                addLog(`Room "${room.id}" created with token gate`);
              }}>Create room</Button>
              <Button size="sm" variant="outline" onClick={() => {
                if (!roomId) return;
                const ok = w3.joinRoom(roomId, walletAddr);
                addLog(ok ? "Joined room ✓" : "Token gate blocked ✗");
              }}>Join room</Button>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="h-4 w-4" /> Messages</h3>
            <div className="mt-3 flex gap-2">
              <input className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="Type a message..." id="web3-msg" />
              <Button size="sm" onClick={() => {
                if (!roomId || !token) return;
                const input = document.getElementById("web3-msg") as HTMLInputElement;
                if (!input?.value.trim()) return;
                const msg = w3.sendMessage(roomId, walletAddr, input.value.trim());
                setMessages((p) => [...p, { sender: msg.sender, content: msg.content, commitment: msg.commitment }]);
                addLog(`Message sent with commitment: ${msg.commitment.slice(0, 16)}...`);
                input.value = "";
              }}>Send</Button>
            </div>
            {messages.length > 0 && (
              <div className="mt-3 space-y-2">
                {messages.map((m, i) => (
                  <div key={i} className="rounded-md border border-border bg-muted/20 p-2">
                    <p className="text-xs font-medium">{m.sender.slice(0, 10)}...</p>
                    <p className="text-sm">{m.content}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{m.commitment.slice(0, 20)}...</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
            {log.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
          </div>
        </div>
      </div>
    </ConsoleShell>
  );
}
