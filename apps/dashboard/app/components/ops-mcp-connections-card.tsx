"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Banner, Button, Section } from "./ui";
import { messageFromUnknown } from "@/lib/error-message";
import {
  opsConnectMcpServer,
  opsDisconnectMcpConnection,
  opsListMcpConnections,
  opsListMcpServers,
  type OpsMcpConnection,
  type OpsMcpServer,
} from "@/lib/ops-client";

/**
 * Per-user OAuth accounts for MCP servers registered with auth="oauth".
 * Connecting opens the provider page; the Worker callback stores the encrypted
 * tokens, and mcp.call uses the run actor's own access token from then on.
 */
export function OpsMcpConnectionsCard({ token }: { token: string }) {
  const [servers, setServers] = useState<OpsMcpServer[]>([]);
  const [connections, setConnections] = useState<OpsMcpConnection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Reloads run through the effect (cancellation-safe); handlers just bump the key.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      try {
        const [listed, linked] = await Promise.all([opsListMcpServers(token), opsListMcpConnections(token)]);
        if (cancelled) return;
        setServers(listed.servers || []);
        setConnections(linked.items || []);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(messageFromUnknown(err, "Could not load MCP connections"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  const reload = () => setReloadKey((key) => key + 1);
  const oauthServers = servers.filter((server) => server.auth === "oauth");
  const connectionFor = (serverId: string) => connections.find((item) => item.serverId === serverId) || null;

  async function connect(server: OpsMcpServer) {
    setBusy(`connect:${server.id}`);
    setNotice(null);
    setError(null);
    try {
      const result = await opsConnectMcpServer(token, server.id);
      if (!result.ok || !result.authorizationUrl) {
        setError(result.message || `Could not start the connection (${result.error || "unknown_error"}).`);
        return;
      }
      window.location.assign(result.authorizationUrl);
    } catch (err) {
      setError(messageFromUnknown(err, "Could not start the connection"));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(connection: OpsMcpConnection) {
    setBusy(`disconnect:${connection.id}`);
    setNotice(null);
    try {
      await opsDisconnectMcpConnection(token, connection.id);
      reload();
      setNotice(`Disconnected ${connection.serverName || connection.serverId}.`);
    } catch (err) {
      setError(messageFromUnknown(err, "Could not disconnect the account"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section
      title="Connected accounts"
      description="Per-user OAuth for MCP servers: a run calls with the account of the user who triggered it, so the provider enforces that user's permissions. Incident and system runs have no user actor and cannot use these servers."
    >
      {error ? <Banner variant="error">{error}</Banner> : null}
      {notice ? <Banner variant="info">{notice}</Banner> : null}
      {!token ? (
        <p className="text-sm text-muted-foreground">Sign in with a project token to connect MCP accounts.</p>
      ) : loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading
        </p>
      ) : null}

      {oauthServers.length ? (
        <ul className="space-y-2">
          {oauthServers.map((server) => {
            const connection = connectionFor(server.id);
            return (
              <li key={server.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {server.name}
                      {server.enabled ? "" : " (off)"}
                    </p>
                    <p className="text-muted-foreground">
                      {connection
                        ? `Connected${connection.scopes ? ` · ${connection.scopes}` : ""}${
                            connection.status !== "active" ? ` · ${connection.status}` : ""
                          }`
                        : "Not connected — calls from your runs are denied until you connect"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!token || busy !== null}
                      onClick={() => void connect(server)}
                    >
                      {connection ? "Reconnect" : "Connect"}
                    </Button>
                    {connection ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!token || busy !== null}
                        onClick={() => void disconnect(connection)}
                      >
                        Disconnect
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : token && !loading ? (
        <p className="text-sm text-muted-foreground">No per-user OAuth MCP server registered.</p>
      ) : null}
    </Section>
  );
}
