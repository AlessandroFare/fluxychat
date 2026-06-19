"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { FluxyChatClient, type FluxyEmbedConfig } from "@fluxy-chat/sdk";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Banner, Button, EmptyState, Panel, SkeletonCard } from "../components/ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";

export default function EmbedWidgetPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();
  const [config, setConfig] = useState<FluxyEmbedConfig | null>(null);
  const [snippet, setSnippet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [defaultRoomId, setDefaultRoomId] = useState("");
  const [allowedOrigins, setAllowedOrigins] = useState("");
  const [launcherTitle, setLauncherTitle] = useState("Chat");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [position, setPosition] = useState<"bottom-right" | "bottom-left">("bottom-right");
  const [zIndex, setZIndex] = useState("2147483000");

  const client = useMemo(() => {
    if (!token) return null;
    return new FluxyChatClient({
      baseUrl: getPublicWorkerUrl(),
      userId: "console",
      token,
    });
  }, [token]);

  const reload = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const data = await client.getEmbedConfig();
      const cfg = data?.config ?? null;
      setConfig(cfg);
      setSnippet(data?.snippet ?? "");
      if (cfg) {
        setDefaultRoomId(cfg.defaultRoomId ?? "");
        setAllowedOrigins((cfg.allowedOrigins ?? []).join("\n"));
        setLauncherTitle(cfg.launcherTitle ?? "Chat");
        setPrimaryColor(cfg.theme?.primaryColor ?? "#2563eb");
        setPosition(
          cfg.theme?.position === "bottom-left" ? "bottom-left" : "bottom-right",
        );
        setZIndex(String(cfg.zIndex ?? 2147483000));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load embed config");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleSave() {
    if (!client) return;
    setError(null);
    try {
      const origins = allowedOrigins
        .split(/[\n,]/)
        .map((o) => o.trim())
        .filter(Boolean);
      const trimmedRoom = defaultRoomId.trim();
      let roomIdPayload: string | null = null;
      if (trimmedRoom) {
        const rooms = await client.listRooms();
        const exists = rooms.some((r) => r.id === trimmedRoom);
        if (!exists) {
          setError(
            `Room "${trimmedRoom}" not found in this project. Pick an existing room ID from Rooms, or leave blank.`,
          );
          return;
        }
        roomIdPayload = trimmedRoom;
      }
      const data = await client.updateEmbedConfig({
        enabled: true,
        defaultRoomId: roomIdPayload,
        allowedOrigins: origins,
        launcherTitle: launcherTitle.trim() || "Chat",
        zIndex: Number(zIndex) || 2147483000,
        theme: { primaryColor, position },
      });
      setConfig(data?.config ?? null);
      setSnippet(data?.snippet ?? "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setError(msg.includes("400") ? `${msg} — check the default room exists and origins are valid.` : msg);
    }
  }

  async function handleDisable() {
    if (!client) return;
    await client.updateEmbedConfig({ enabled: false });
    await reload();
  }

  async function copySnippet() {
    if (!snippet) return;
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Embed widget"
        description="Add a chat bubble to any site with one script tag. Origin allowlist protects guest sessions."
        actions={
          <Button variant="ghost" size="sm" onClick={() => void reload()} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {error ? <Banner variant="error">{error}</Banner> : null}

      {loading && !config ? (
        <SkeletonCard />
      ) : !token ? (
        <EmptyState title="Sign in required" description="Open the dashboard with an admin JWT." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Configuration">
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">
                  Default public room ID
                  <span className="ml-1 font-normal text-xs">(must exist — see Rooms)</span>
                </span>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={defaultRoomId}
                  onChange={(e) => setDefaultRoomId(e.target.value)}
                  placeholder="room_support"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">
                  Allowed parent origins (one per line)
                </span>
                <textarea
                  className="min-h-[96px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                  value={allowedOrigins}
                  onChange={(e) => setAllowedOrigins(e.target.value)}
                  placeholder={"https://www.acme.com\nhttps://app.acme.com"}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Launcher title</span>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={launcherTitle}
                    onChange={(e) => setLauncherTitle(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Z-index</span>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={zIndex}
                    onChange={(e) => setZIndex(e.target.value)}
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Primary color</span>
                  <input
                    type="color"
                    className="h-10 w-full cursor-pointer rounded-md border border-border bg-background"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Position</span>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={position}
                    onChange={(e) =>
                      setPosition(e.target.value === "bottom-left" ? "bottom-left" : "bottom-right")
                    }
                  >
                    <option value="bottom-right">Bottom right</option>
                    <option value="bottom-left">Bottom left</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void handleSave()}>Save & enable</Button>
                {config?.enabled ? (
                  <Button variant="ghost" onClick={() => void handleDisable()}>
                    Disable widget
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Status: {config?.enabled ? "enabled" : "disabled"}. Guest sessions from the iframe
                validate <code className="text-xs">embedParentOrigin</code> against this list (plus
                custom-domain origins).
              </p>
            </div>
          </Panel>

          <Panel title="Install snippet">
            {snippet ? (
              <div className="space-y-3">
                <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">{snippet}</pre>
                <Button variant="secondary" size="sm" onClick={() => void copySnippet()}>
                  <Copy className="mr-2 h-4 w-4" />
                  {copied ? "Copied" : "Copy snippet"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Paste before <code className="text-xs">&lt;/body&gt;</code> on pages listed in the
                  allowlist. Use your custom domain Worker URL when white-labeling (P12-G).
                </p>
              </div>
            ) : (
              <EmptyState title="No snippet yet" description="Save configuration to generate the script tag." />
            )}
          </Panel>
        </div>
      )}
    </ConsoleShell>
  );
}
