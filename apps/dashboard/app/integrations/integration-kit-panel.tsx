"use client";

import { useCallback, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Panel } from "~/components/ui/Panel";
import { useDashboardSession } from "../components/dashboard-session";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { messageFromUnknown } from "@/lib/error-message";

export function IntegrationKitPanel() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();
  const worker = getPublicWorkerUrl();
  const [provider, setProvider] = useState("linear");
  const [signingSecret, setSigningSecret] = useState("");
  const [entity, setEntity] = useState("linear:issue:ENG-123");
  const [roomId, setRoomId] = useState("");
  const [log, setLog] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const headers = useCallback(
    () => ({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    [token],
  );

  async function saveConnection() {
    setError(null);
    try {
      const data = await fetchWorkerJson<{ connection?: { id: string } }>(`${worker}/integrations/connections`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ provider, signingSecret: signingSecret || undefined }),
      });
      setLog(`Saved ${provider} (${data.connection?.id || "ok"}). Webhook: ${worker}/integrations/webhooks/<projectId>/${provider}`);
    } catch (err) {
      setError(messageFromUnknown(err, "Save failed"));
    }
  }

  async function linkEntity() {
    setError(null);
    try {
      const data = await fetchWorkerJson<{ link?: { roomId: string } }>(`${worker}/integrations/entity-links`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ roomId, entity }),
      });
      setLog(`Linked ${entity} → ${data.link?.roomId}`);
    } catch (err) {
      setError(messageFromUnknown(err, "Link failed"));
    }
  }

  async function kill() {
    setError(null);
    try {
      await fetchWorkerJson(`${worker}/integrations/connections/${encodeURIComponent(provider)}/kill`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ killSwitch: true }),
      });
      setLog(`Kill switch on for ${provider}`);
    } catch (err) {
      setError(messageFromUnknown(err, "Kill failed"));
    }
  }

  return (
    <Panel className="rounded-2xl p-5">
      <h3 className="text-sm font-semibold">Entity rooms</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Signed inbound webhooks + a room per issue/PR/incident. Not a Marketplace install. Writes still need
        a human-approved intent. Slack content is no-train. Local save of the signing secret needs{" "}
        <code>WEBHOOK_SECRET_ENCRYPTION_KEY</code> or <code>ALLOW_PLAINTEXT_WEBHOOK_SECRETS=true</code>.
      </p>
      {!token ? (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">Admin JWT required. Copy one from Projects after onboarding.</p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-md border border-border bg-background px-2 py-2 text-sm"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {["linear", "github", "slack", "pagerduty", "incidentio", "sentry", "zendesk", "intercom", "hubspot", "notion", "jira"].map(
                (id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ),
              )}
            </select>
            <Input
              className="min-w-[12rem] flex-1"
              type="password"
              placeholder="Webhook signing secret"
              value={signingSecret}
              onChange={(e) => setSigningSecret(e.target.value)}
            />
            <Button size="sm" onClick={() => void saveConnection()}>
              Save connection
            </Button>
            <Button size="sm" variant="outline" onClick={() => void kill()}>
              Kill switch
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-[12rem] flex-1"
              placeholder="linear:issue:ENG-123"
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
            />
            <Input
              className="min-w-[10rem] flex-1"
              placeholder="Room id"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
            <Button size="sm" variant="secondary" onClick={() => void linkEntity()}>
              Link entity
            </Button>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {log ? <p className="text-xs text-muted-foreground">{log}</p> : null}
        </div>
      )}
    </Panel>
  );
}
