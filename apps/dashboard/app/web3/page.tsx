"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConsoleProjectRoomBar } from "../components/console-project-room-bar";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";
import { useDashboardSession } from "../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import {
  getWalletAllowlist,
  requestWalletNonce,
  saveWalletAllowlist,
  verifyWalletSiwe,
} from "@/lib/wallet-auth-client";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getEthereum(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const injected = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  return injected ?? null;
}

export default function Web3Page() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();
  const [address, setAddress] = useState("");
  const [memberJwt, setMemberJwt] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [allowlistText, setAllowlistText] = useState("");
  const [allowlistBusy, setAllowlistBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    void getWalletAllowlist(token)
      .then((row) => setAllowlistText((row.addresses ?? []).join("\n")))
      .catch(() => undefined);
  }, [token]);

  async function connectAndMint() {
    setStatus(null);
    const eth = getEthereum();
    if (!eth) {
      setStatus("No injected wallet. Install MetaMask or another EIP-1193 provider.");
      return;
    }
    if (!token) {
      setStatus("Admin JWT required. Finish Quickstart so the console can mint for this project.");
      return;
    }
    setBusy(true);
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const wallet = String(accounts?.[0] || "");
      if (!wallet) throw new Error("No account returned");
      setAddress(wallet);
      const nonce = await requestWalletNonce(token, wallet);
      const signature = (await eth.request({
        method: "personal_sign",
        params: [nonce.message, wallet],
      })) as string;
      const minted = await verifyWalletSiwe(token, {
        address: wallet,
        message: nonce.message,
        signature,
      });
      setMemberJwt(minted.token);
      setStatus(`Minted member JWT for ${minted.userId}. Use it in useChat. Token gates stay on your server.`);
    } catch (err: unknown) {
      setStatus(messageFromUnknown(err, "Wallet sign-in failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Web3 rooms"
        description="SIWE on the Worker. FluxyChat does not run a chain, mint tokens, or custody keys."
      />

      <ConsoleProjectRoomBar
        hint="Console uses GET/POST /admin/auth/wallet. Apps use the same verify with fc_ on GET/POST /auth/wallet."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel className="p-4">
          <h2 className="text-sm font-semibold">Connect wallet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The Worker issues a nonce, you sign it in the wallet, then you get a member JWT whose
            userId is the address. Token-gated rooms: check balance on your backend before you let
            that user in.
          </p>
          <Button className="mt-4" size="sm" disabled={busy} onClick={() => void connectAndMint()}>
            {busy ? "Waiting for signature…" : "Sign in with Ethereum"}
          </Button>
          {address ? <p className="mt-3 font-mono text-xs text-muted-foreground">{address}</p> : null}
          {status ? <p className="mt-3 text-sm">{status}</p> : null}
          {memberJwt ? (
            <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-[10px]">
              {memberJwt}
            </pre>
          ) : null}
        </Panel>
        <Panel className="p-4">
          <h2 className="text-sm font-semibold">Address allowlist</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Empty list: any wallet that completes SIWE gets a JWT. Non-empty: only listed addresses.
            NFT/balance checks still belong on your RPC if you need them.
          </p>
          <textarea
            className="mt-3 min-h-28 w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
            value={allowlistText}
            onChange={(e) => setAllowlistText(e.target.value)}
            placeholder="0xabc… one address per line"
          />
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            disabled={allowlistBusy || !token}
            onClick={() => {
              setAllowlistBusy(true);
              const addresses = allowlistText
                .split(/[\s,]+/)
                .map((row) => row.trim())
                .filter(Boolean);
              void saveWalletAllowlist(token, addresses)
                .then((row) => {
                  setAllowlistText((row.addresses ?? []).join("\n"));
                  setStatus(`Allowlist saved (${row.addresses?.length ?? 0} addresses).`);
                })
                .catch((err) => setStatus(messageFromUnknown(err, "Allowlist save failed")))
                .finally(() => setAllowlistBusy(false));
            }}
          >
            {allowlistBusy ? "Saving…" : "Save allowlist"}
          </Button>
        </Panel>
        <Panel className="p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold">From your app</h2>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
{`GET /auth/wallet/nonce?address=0x…
X-Fluxy-Api-Key: fc_...

POST /auth/wallet
{ "address", "message", "signature" }`}
          </pre>
          <p className="mt-3 text-sm text-muted-foreground">
            Docs:{" "}
            <a className="underline underline-offset-2" href="https://docs.fluxychat.com/docs/platform/web3">
              platform/web3
            </a>
            {" · "}
            <Link className="underline underline-offset-2" href="/docs">
              dashboard docs
            </Link>
          </p>
        </Panel>
      </div>
    </ConsoleShell>
  );
}
