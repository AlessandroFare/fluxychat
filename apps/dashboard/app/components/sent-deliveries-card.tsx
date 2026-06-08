"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Panel, Button, Banner } from "./ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { messageFromUnknown } from "@/lib/error-message";

const WORKER_URL = getPublicWorkerUrl();

interface SentDelivery {
  id: string;
  room_id: string | null;
  user_id: string;
  to_e164: string;
  sent_message_id: string | null;
  status: string;
  channel: string;
  error: string | null;
  created_at: string;
}

export function SentDeliveriesCard({ adminJwt }: { adminJwt: string }) {
  const [rows, setRows] = useState<SentDelivery[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!adminJwt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const json = await fetchWorkerJson<{ deliveries?: SentDelivery[] }>(
        `${WORKER_URL}/admin/integrations/sent/deliveries?limit=20`,
        {
          headers: { Authorization: `Bearer ${adminJwt.trim()}` },
        },
      );
      setRows(json.deliveries ?? []);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to load Sent deliveries"));
    } finally {
      setLoading(false);
    }
  }, [adminJwt]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Panel className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Sent.dm deliveries</h3>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
          Refresh
        </Button>
      </div>
      {error ? <Banner variant="error">{error}</Banner> : null}
      {!rows.length && !loading ? (
        <p className="text-xs text-muted-foreground">No outbound SMS/WhatsApp records yet.</p>
      ) : (
        <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
          {rows.map((row) => (
            <li key={row.id} className="rounded border border-border/60 p-2 font-mono">
              <span className="text-brand">{row.status}</span> · {row.channel} · user {row.user_id}
              {row.sent_message_id ? ` · sent:${row.sent_message_id.slice(0, 8)}…` : null}
              {row.error ? <span className="block text-amber-600">{row.error}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
