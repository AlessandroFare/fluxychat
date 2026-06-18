"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Panel, Button, Banner, Input } from "./ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { messageFromUnknown } from "@/lib/error-message";

const WORKER_URL = getPublicWorkerUrl();

interface SentContactRow {
  id: string;
  user_id: string | null;
  e164: string;
  sent_contact_id: string | null;
  opt_out: number;
  default_channel: string | null;
  synced_at: string;
}

export function SentContactsCard({ adminJwt }: { adminJwt: string }) {
  const [rows, setRows] = useState<SentContactRow[]>([]);
  const [e164, setE164] = useState("");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adminJwt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const json = await fetchWorkerJson<{ contacts?: SentContactRow[] }>(
        `${WORKER_URL}/admin/integrations/sent/contacts?limit=30`,
        { headers: { Authorization: `Bearer ${adminJwt.trim()}` } },
      );
      setRows(json.contacts ?? []);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to load contacts"));
    } finally {
      setLoading(false);
    }
  }, [adminJwt]);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncContact() {
    if (!adminJwt.trim() || !e164.trim()) return;
    setSyncMsg(null);
    try {
      const json = await fetchWorkerJson<{ ok?: boolean; contact?: { optOut?: boolean } }>(
        `${WORKER_URL}/integrations/sent/contacts/sync`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminJwt.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            e164: e164.trim(),
            ...(userId.trim() ? { userId: userId.trim() } : {}),
          }),
        },
      );
      setSyncMsg(
        json.contact?.optOut
          ? "Synced — contact opted out (SMS disabled in preferences)"
          : "Synced from Sent.dm",
      );
      void load();
    } catch (err: unknown) {
      setSyncMsg(messageFromUnknown(err, "Sync failed"));
    }
  }

  return (
    <Panel className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Sent.dm contacts (opt-out mirror)</h3>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
          Refresh
        </Button>
      </div>
      {error ? <Banner variant="error">{error}</Banner> : null}
      <div className="mb-3 flex flex-wrap gap-2">
        <Input
          className="max-w-[180px]"
          value={e164}
          onChange={(e) => setE164(e.target.value)}
          placeholder="+14155551234"
        />
        <Input
          className="max-w-[140px]"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="user id (optional)"
        />
        <Button type="button" size="sm" onClick={() => void syncContact()}>
          Sync from Sent
        </Button>
      </div>
      {syncMsg ? <p className="mb-2 text-xs text-muted-foreground">{syncMsg}</p> : null}
      {!rows.length && !loading ? (
        <p className="text-xs text-muted-foreground">No mirrored contacts yet.</p>
      ) : (
        <ul className="max-h-40 space-y-2 overflow-y-auto text-xs">
          {rows.map((row) => (
            <li key={row.id} className="rounded border border-border/60 p-2 font-mono">
              {row.e164} · {row.opt_out ? "opt-out" : "ok"}
              {row.user_id ? ` · ${row.user_id}` : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

