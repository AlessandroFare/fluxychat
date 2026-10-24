"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Banner, Button, Input, Section, Textarea } from "./ui";
import { messageFromUnknown } from "@/lib/error-message";
import {
  opsDeleteMcpServer,
  opsListMcpServers,
  opsReapproveMcpTool,
  opsRefreshMcpServer,
  opsRegisterMcpServer,
  opsTryMcpTool,
  type OpsMcpDiscovery,
  type OpsMcpServer,
  type OpsMcpToolInfo,
} from "@/lib/ops-client";

/** Discovery catalog when we have details, the pinned registry catalog otherwise. */
function toolCatalog(server: OpsMcpServer, discovery?: OpsMcpDiscovery): OpsMcpToolInfo[] {
  if (discovery?.catalog?.length) return discovery.catalog;
  if (server.toolsCatalog?.length) return server.toolsCatalog;
  const names = discovery?.tools?.length ? discovery.tools : server.discoveredTools || [];
  return names.map((name) => ({ name }));
}

/** Args skeleton from the pinned schema, so Try starts from the real shape. */
function tryArgsSkeleton(schema?: Record<string, unknown> | null): string {
  const properties = (
    schema?.properties && typeof schema.properties === "object" ? schema.properties : {}
  ) as Record<string, { type?: string }>;
  const required = Array.isArray(schema?.required) ? (schema.required as string[]) : [];
  const args: Record<string, unknown> = {};
  for (const key of required) {
    const type = properties[key]?.type;
    args[key] =
      type === "number" || type === "integer"
        ? 0
        : type === "boolean"
          ? false
          : type === "array"
            ? []
            : type === "object"
              ? {}
              : "";
  }
  return JSON.stringify(args, null, 2);
}

export function OpsMcpServersCard({ token }: { token: string }) {
  const [servers, setServers] = useState<OpsMcpServer[]>([]);
  const [catalog, setCatalog] = useState<Record<string, OpsMcpToolInfo[]>>({});
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [authMode, setAuthMode] = useState<"secret" | "oauth">("secret");
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [oauthAuthorizeUrl, setOauthAuthorizeUrl] = useState("");
  const [oauthTokenUrl, setOauthTokenUrl] = useState("");
  const [oauthScopes, setOauthScopes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [tryTarget, setTryTarget] = useState<{ serverId: string; serverName: string; tool: string } | null>(null);
  const [tryArgs, setTryArgs] = useState("{}");
  const [tryResult, setTryResult] = useState<string | null>(null);
  const [tryError, setTryError] = useState<string | null>(null);

  // Reloads run through the effect (cancellation-safe); handlers just bump the key.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      try {
        const listed = await opsListMcpServers(token);
        if (cancelled) return;
        setServers(listed.servers || []);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(messageFromUnknown(err, "Could not load MCP servers"));
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

  function keepDiscovery(server: OpsMcpServer, discovery?: OpsMcpDiscovery) {
    const tools = toolCatalog(server, discovery);
    if (tools.length) setCatalog((prev) => ({ ...prev, [server.id]: tools }));
    setPicked((prev) => ({ ...prev, [server.id]: prev[server.id] ?? server.allowedTools ?? [] }));
  }

  function selectedTools(server: OpsMcpServer): string[] {
    return picked[server.id] ?? server.allowedTools ?? [];
  }

  function toggleTool(serverId: string, tool: string) {
    setPicked((prev) => {
      const current = prev[serverId] ?? [];
      return { ...prev, [serverId]: current.includes(tool) ? current.filter((item) => item !== tool) : [...current, tool] };
    });
  }

  async function saveTools(server: OpsMcpServer) {
    setBusy(`tools:${server.id}`);
    setNotice(null);
    try {
      // Re-registering without a secret keeps the stored one.
      const saved = await opsRegisterMcpServer(token, { name: server.name, url: server.url, allowedTools: selectedTools(server) });
      if (saved.server) keepDiscovery(saved.server, saved.discovery);
      reload();
      setNotice(`Allowed tools saved for ${server.name}.`);
    } catch (err) {
      setError(messageFromUnknown(err, "Could not save tools"));
    } finally {
      setBusy(null);
    }
  }

  async function toggleEnabled(server: OpsMcpServer) {
    setBusy(`enabled:${server.id}`);
    setNotice(null);
    try {
      await opsRegisterMcpServer(token, { name: server.name, url: server.url, enabled: !server.enabled });
      reload();
    } catch (err) {
      setError(messageFromUnknown(err, "Could not update the server"));
    } finally {
      setBusy(null);
    }
  }

  async function refreshTools(server: OpsMcpServer) {
    setBusy(`refresh:${server.id}`);
    setNotice(null);
    try {
      const refreshed = await opsRefreshMcpServer(token, server.id);
      if (refreshed.server) keepDiscovery(refreshed.server, refreshed.discovery);
      reload();
      setNotice(
        refreshed.discovery?.ok
          ? `Discovered ${refreshed.discovery.tools?.length ?? 0} tool(s) on ${server.name}.`
          : `Discovery failed on ${server.name} (${refreshed.discovery?.error || "unreachable"}). Check the URL, the secret and ALLOWED_SSRF_HOSTS.`,
      );
    } catch (err) {
      setError(messageFromUnknown(err, "Could not refresh tools"));
    } finally {
      setBusy(null);
    }
  }

  async function reapproveTool(server: OpsMcpServer, tool: string) {
    setBusy(`approve:${server.id}:${tool}`);
    setNotice(null);
    try {
      const result = await opsReapproveMcpTool(token, server.id, tool);
      if (result.server) keepDiscovery(result.server);
      reload();
      setNotice(`Re-approved ${tool} on ${server.name}; calls are unblocked.`);
    } catch (err) {
      setError(messageFromUnknown(err, "Could not re-approve the tool"));
    } finally {
      setBusy(null);
    }
  }

  function openTry(server: OpsMcpServer, tool: OpsMcpToolInfo) {
    setTryTarget({ serverId: server.id, serverName: server.name, tool: tool.name });
    setTryArgs(tryArgsSkeleton(tool.inputSchema));
    setTryResult(null);
    setTryError(null);
  }

  function closeTry() {
    setTryTarget(null);
    setTryResult(null);
    setTryError(null);
  }

  async function runTry() {
    if (!tryTarget) return;
    let args: unknown;
    try {
      args = tryArgs.trim() ? JSON.parse(tryArgs) : {};
    } catch {
      setTryError("Arguments must be valid JSON.");
      return;
    }
    if (typeof args !== "object" || args === null || Array.isArray(args)) {
      setTryError("Arguments must be a JSON object.");
      return;
    }
    setBusy(`try:${tryTarget.serverId}:${tryTarget.tool}`);
    setTryError(null);
    setTryResult(null);
    try {
      const result = await opsTryMcpTool(token, tryTarget.serverId, tryTarget.tool, args as Record<string, unknown>);
      setTryResult(JSON.stringify(result, null, 2));
    } catch (err) {
      setTryError(messageFromUnknown(err, "Could not call the tool"));
    } finally {
      setBusy(null);
    }
  }

  async function removeServer(server: OpsMcpServer) {
    setBusy(`delete:${server.id}`);
    setNotice(null);
    try {
      await opsDeleteMcpServer(token, server.id);
      reload();
      setNotice(`Removed ${server.name}.`);
    } catch (err) {
      setError(messageFromUnknown(err, "Could not remove the server"));
    } finally {
      setBusy(null);
    }
  }

  async function register() {
    setBusy("register");
    setNotice(null);
    setError(null);
    try {
      const oauth = authMode === "oauth";
      const result = await opsRegisterMcpServer(token, {
        name,
        url,
        auth: oauth ? "oauth" : "secret",
        ...(oauth
          ? {
              ...(oauthClientId.trim() ? { oauthClientId: oauthClientId.trim() } : {}),
              ...(oauthClientSecret.trim() ? { oauthClientSecret: oauthClientSecret.trim() } : {}),
              ...(oauthAuthorizeUrl.trim() ? { oauthAuthorizeUrl: oauthAuthorizeUrl.trim() } : {}),
              ...(oauthTokenUrl.trim() ? { oauthTokenUrl: oauthTokenUrl.trim() } : {}),
              ...(oauthScopes.trim() ? { oauthScopes: oauthScopes.trim() } : {}),
            }
          : secret.trim()
            ? { secret: secret.trim() }
            : {}),
        allowedTools: [],
      });
      if (result.server) keepDiscovery(result.server, result.discovery);
      reload();
      setName("");
      setUrl("");
      setSecret("");
      setOauthClientId("");
      setOauthClientSecret("");
      setOauthAuthorizeUrl("");
      setOauthTokenUrl("");
      setOauthScopes("");
      setNotice(
        oauth
          ? `Registered ${result.server?.name} with per-user OAuth. Connect your account under Connected accounts; tools appear after the first connection.`
          : result.discovery?.ok
            ? `Registered ${result.server?.name}. Pick the tools this project may call, then save.`
            : `Registered ${result.server?.name}, but discovery failed (${result.discovery?.error || "unreachable"}). Use Refresh tools after checking the URL, the secret and ALLOWED_SSRF_HOSTS.`,
      );
    } catch (err) {
      setError(messageFromUnknown(err, "Could not register the server"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section
      title="MCP servers"
      description="External MCP servers mcp.call may reach. Secrets are encrypted at rest and never shown again. Tool names are opt-in: calls stay denied until you allow them, and a tool definition that changes after approval stays blocked until you re-approve it. Needs an admin token."
    >
      {error ? <Banner variant="error">{error}</Banner> : null}
      {notice ? <Banner variant="info">{notice}</Banner> : null}
      {!token ? (
        <p className="text-sm text-muted-foreground">Sign in with a project token to manage MCP servers.</p>
      ) : loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading
        </p>
      ) : null}

      {servers.length ? (
        <ul className="space-y-2">
          {servers.map((server) => {
            const tools = catalog[server.id] || toolCatalog(server);
            const selected = selectedTools(server);
            return (
              <li key={server.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {server.name}
                      {server.enabled ? "" : " (off)"}
                    </p>
                    <p className="text-muted-foreground">
                      {server.url} ·{" "}
                      {server.auth === "enterprise"
                        ? "per-user enterprise sign-in (ID-JAG)"
                        : server.auth === "oauth"
                          ? "per-user OAuth"
                          : server.hasSecret
                            ? "secret set"
                            : "no secret"}
                    </p>
                    <p className="text-muted-foreground">
                      Allowed: {server.allowedTools?.length ? server.allowedTools.join(", ") : "none — mcp.call is denied"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!token || busy !== null}
                      onClick={() => void refreshTools(server)}
                    >
                      Refresh tools
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!token || busy !== null}
                      onClick={() => void toggleEnabled(server)}
                    >
                      {server.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={!token || busy !== null}
                      onClick={() => void removeServer(server)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                {tools.length ? (
                  <div className="mt-2 border-t border-border/60 pt-2">
                    <p className="text-xs text-muted-foreground">Tools this server exposes</p>
                    <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      {tools.map((tool) => (
                        <li key={tool.name} className="flex flex-wrap items-center gap-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={selected.includes(tool.name)}
                              disabled={!token || busy !== null}
                              onChange={() => toggleTool(server.id, tool.name)}
                            />
                            <span className={tool.readOnly ? "text-muted-foreground" : "font-medium"}>{tool.name}</span>
                            {tool.description ? (
                              <span className="text-xs text-muted-foreground">{tool.description}</span>
                            ) : null}
                          </label>
                          {tool.changed ? (
                            <>
                              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                                definition changed — calls blocked
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!token || busy !== null}
                                onClick={() => void reapproveTool(server, tool.name)}
                              >
                                Re-approve
                              </Button>
                            </>
                          ) : null}
                          {tool.readOnly ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!token || busy !== null}
                              onClick={() => openTry(server, tool)}
                            >
                              Try
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {tryTarget && tryTarget.serverId === server.id ? (
                      <div className="mt-2 rounded-md border border-border/60 p-2">
                        <p className="text-xs font-medium">
                          Try {tryTarget.tool} on {tryTarget.serverName} — read-only tool, call audited
                        </p>
                        <Textarea
                          className="mt-1 font-mono text-xs"
                          rows={3}
                          aria-label="Tool arguments"
                          placeholder="{}"
                          value={tryArgs}
                          onChange={(event) => setTryArgs(event.target.value)}
                        />
                        {tryError ? <p className="mt-1 text-xs text-red-500">{tryError}</p> : null}
                        {tryResult ? (
                          <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted/40 p-2 text-xs">{tryResult}</pre>
                        ) : null}
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={!token || busy !== null}
                            onClick={() => void runTry()}
                          >
                            Run
                          </Button>
                          <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={closeTry}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      disabled={!token || busy !== null}
                      onClick={() => void saveTools(server)}
                    >
                      Save allowed tools
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                    No tools discovered yet — use Refresh tools.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : token && !loading ? (
        <p className="text-sm text-muted-foreground">No MCP server registered.</p>
      ) : null}

      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-2 text-sm font-medium">Register a server</p>
        <div className="mb-2 grid gap-2 sm:grid-cols-3">
          <Input placeholder="name (a-z, 0-9, -)" value={name} onChange={(event) => setName(event.target.value)} />
          <Input placeholder="https://mcp.example.com/mcp" value={url} onChange={(event) => setUrl(event.target.value)} />
          <label className="block">
            <span className="sr-only">Authentication</span>
            <select
              aria-label="Authentication"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={authMode}
              onChange={(event) => setAuthMode(event.target.value === "oauth" ? "oauth" : "secret")}
            >
              <option value="secret">Shared bearer secret</option>
              <option value="oauth">Per-user OAuth</option>
            </select>
          </label>
          {authMode === "secret" ? (
            <Input
              type="password"
              placeholder="bearer secret (optional)"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
            />
          ) : (
            <>
              <Input
                placeholder="OAuth client id (optional with dynamic registration)"
                value={oauthClientId}
                onChange={(event) => setOauthClientId(event.target.value)}
              />
              <Input
                type="password"
                placeholder="OAuth client secret (optional)"
                value={oauthClientSecret}
                onChange={(event) => setOauthClientSecret(event.target.value)}
              />
              <Input
                placeholder="scopes, space separated (optional)"
                value={oauthScopes}
                onChange={(event) => setOauthScopes(event.target.value)}
              />
              <Input
                placeholder="authorization URL (optional, overrides discovery)"
                value={oauthAuthorizeUrl}
                onChange={(event) => setOauthAuthorizeUrl(event.target.value)}
              />
              <Input
                placeholder="token URL (optional, overrides discovery)"
                value={oauthTokenUrl}
                onChange={(event) => setOauthTokenUrl(event.target.value)}
              />
            </>
          )}
        </div>
        <Button type="button" disabled={!token || busy !== null || !name.trim() || !url.trim()} onClick={() => void register()}>
          {authMode === "oauth" ? "Register OAuth server" : "Register and discover"}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          {authMode === "oauth"
            ? "Each member connects their own account; mcp.call uses the run actor's token. Without metadata, set both URLs. The authorization server host must also be in ALLOWED_SSRF_HOSTS."
            : "Register and discover tools now. Secrets are encrypted with WEBHOOK_SECRET_ENCRYPTION_KEY."}{" "}
          The MCP host must be in the Worker&apos;s <code className="text-[10px]">ALLOWED_SSRF_HOSTS</code>; loopback and
          private addresses stay blocked.
        </p>
      </div>
    </Section>
  );
}
