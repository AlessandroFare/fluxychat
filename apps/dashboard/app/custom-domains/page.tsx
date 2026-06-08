"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Globe, RefreshCw } from "lucide-react";
import { FluxyChatClient, type FluxyCustomDomain } from "@fluxy-chat/sdk";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Banner, Button, EmptyState, Panel, SkeletonCard } from "../components/ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { cn } from "@/lib/utils";

export default function CustomDomainsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();
  const [domains, setDomains] = useState<FluxyCustomDomain[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hostname, setHostname] = useState("");
  const [defaultRoomId, setDefaultRoomId] = useState("");
  const [brandName, setBrandName] = useState("");

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
      const list = await client.listCustomDomains();
      setDomains(list?.domains ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load domains");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCreate() {
    if (!client || !hostname.trim()) return;
    await client.createCustomDomain({
      hostname: hostname.trim(),
      defaultRoomId: defaultRoomId.trim() || null,
      brandName: brandName.trim() || null,
    });
    setHostname("");
    setDefaultRoomId("");
    setBrandName("");
    await reload();
  }

  async function handleActivate(id: string) {
    if (!client) return;
    await client.updateCustomDomain(id, { status: "active" });
    await reload();
  }

  async function handleDisable(id: string) {
    if (!client) return;
    await client.updateCustomDomain(id, { status: "disabled" });
    await reload();
  }

  async function handleDelete(id: string) {
    if (!client) return;
    await client.deleteCustomDomain(id);
    await reload();
  }

  return (
    <ConsoleShell className="max-w-3xl">
      <ConsolePageHeader
        title="Custom domains"
        description="Map chat.yourcompany.com to your project. Attach the hostname in Cloudflare for SaaS, then activate here."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void reload()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {!token && (
        <Banner variant="info">Sign in with an admin JWT to manage custom domains.</Banner>
      )}
      {error && <Banner variant="error">{error}</Banner>}

      <Panel className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Add hostname</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
            placeholder="chat.acme.com"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
          />
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Default room id (optional)"
            value={defaultRoomId}
            onChange={(e) => setDefaultRoomId(e.target.value)}
          />
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Brand name (optional)"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
          />
        </div>
        <Button onClick={() => void handleCreate()} disabled={!client || !hostname.trim()}>
          Register domain
        </Button>
        <p className="text-xs text-muted-foreground">
          Use a subdomain (not www). Point DNS to your Worker via Cloudflare custom hostnames, then
          set status to active after TLS is ready.
        </p>
      </Panel>

      {loading && !domains.length ? (
        <div className="mt-4 space-y-3">
          <SkeletonCard />
        </div>
      ) : null}

      {domains.length === 0 && !loading ? (
        <EmptyState
          className="mt-6"
          icon={Globe}
          title="No custom domains"
          description="Register chat.yourcompany.com to white-label the Worker API for your project."
        />
      ) : null}

      <ul className="mt-4 space-y-3">
        {domains.map((d) => (
          <li key={d.id}>
            <Panel className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{d.hostname}</p>
                <p className="text-xs text-muted-foreground">
                  {d.status}
                  {d.defaultRoomId ? ` · default room ${d.defaultRoomId}` : ""}
                  {d.brandName ? ` · ${d.brandName}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {d.status === "pending" ? (
                  <Button size="sm" onClick={() => void handleActivate(d.id)}>
                    Activate
                  </Button>
                ) : null}
                {d.status === "active" ? (
                  <Button size="sm" variant="secondary" onClick={() => void handleDisable(d.id)}>
                    Disable
                  </Button>
                ) : null}
                <Button size="sm" variant="secondary" onClick={() => void handleDelete(d.id)}>
                  Delete
                </Button>
              </div>
            </Panel>
          </li>
        ))}
      </ul>
    </ConsoleShell>
  );
}
