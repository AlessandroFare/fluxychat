"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, MessageSquareShare, Send } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { RoomPicker } from "../../components/room-picker";
import { Button, Input, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  dispatchChannelForm,
  listChannelFormDeliveries,
  rcsFormWebhookUrl,
  whatsAppFormWebhookUrl,
  type ChannelFormDelivery,
} from "@/lib/channel-forms-client";

export default function ChannelFormsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [deliveries, setDeliveries] = useState<ChannelFormDelivery[]>([]);
  const [roomId, setRoomId] = useState("");
  const [recipientE164, setRecipientE164] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "rcs">("whatsapp");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await listChannelFormDeliveries(token, roomId.trim() || undefined);
      setDeliveries(res.deliveries ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load form deliveries"));
    } finally {
      setLoading(false);
    }
  }, [token, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDispatch() {
    if (!token || !roomId.trim() || !recipientE164.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await dispatchChannelForm(token, {
        roomId: roomId.trim(),
        channel,
        recipientE164: recipientE164.trim(),
        schema: {
          title: "Support intake",
          description: "Quick structured intake via channel",
          fields: [
            { id: "topic", label: "What do you need help with?", type: "select", options: [
              { value: "billing", label: "Billing" },
              { value: "technical", label: "Technical" },
              { value: "other", label: "Other" },
            ]},
            { id: "urgent", label: "Is this urgent?", type: "yes_no" },
          ],
        },
      });
      if (res.dryRun) {
        setNotice(`Dry-run delivery ${res.deliveryId}. Configure WhatsApp/RCS credentials on the worker.`);
      } else {
        setNotice(`Form dispatched (${res.fieldCount} fields) → ${res.deliveryId}`);
      }
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Dispatch failed"));
    } finally {
      setBusy(false);
    }
  }

  function copyWebhook(url: string) {
    void navigator.clipboard.writeText(url);
    setNotice("Webhook URL copied.");
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="WhatsApp / RCS forms"
        description="Structured forms on omnichannel: schema to provider interactive payload to normalized room message."
      />

      <p className="mb-4 text-sm text-muted-foreground">
        <Link href="/bridges" className="font-medium underline-offset-4 hover:underline">
          ← Bridges
        </Link>
        {" · "}
        Configure <code className="text-xs">WHATSAPP_*</code> or omnichannel channel settings with Meta credentials.
      </p>

      <ConsoleFeedback error={error} notice={notice} />

      {!token ? (
        <Panel className="p-6 text-sm text-muted-foreground">Admin JWT required.</Panel>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : (
        <div className="space-y-8">
          <Section title="Dispatch intake form">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Room</label>
                <RoomPicker value={roomId} onChange={setRoomId} token={token} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Recipient E.164</label>
                <Input
                  value={recipientE164}
                  onChange={(e) => setRecipientE164(e.target.value)}
                  placeholder="+393331234567"
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Channel</label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as "whatsapp" | "rcs")}
                >
                  <option value="whatsapp">WhatsApp (Cloud API interactive)</option>
                  <option value="rcs">RCS (suggested replies)</option>
                </select>
              </div>
            </div>
            <Button size="sm" className="mt-3" disabled={busy} onClick={() => void handleDispatch()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send structured form
            </Button>
          </Section>

          <Section title="Inbound webhooks">
            <ul className="space-y-2 text-sm">
              <li className="flex flex-wrap items-center gap-2">
                <MessageSquareShare className="h-4 w-4 text-muted-foreground" />
                <code className="break-all text-xs">{whatsAppFormWebhookUrl()}</code>
                <Button size="sm" variant="ghost" onClick={() => copyWebhook(whatsAppFormWebhookUrl())}>
                  <Copy className="h-3 w-3" />
                </Button>
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <MessageSquareShare className="h-4 w-4 text-muted-foreground" />
                <code className="break-all text-xs">{rcsFormWebhookUrl()}</code>
                <Button size="sm" variant="ghost" onClick={() => copyWebhook(rcsFormWebhookUrl())}>
                  <Copy className="h-3 w-3" />
                </Button>
              </li>
            </ul>
          </Section>

          <Section title="Recent deliveries">
            {deliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deliveries yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border border-border text-sm">
                {deliveries.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                    <Badge variant={d.status === "completed" ? "default" : d.status === "failed" ? "destructive" : "secondary"}>
                      {d.status}
                    </Badge>
                    <span className="font-mono text-xs">{d.channel}</span>
                    <span className="text-muted-foreground">{d.recipientE164}</span>
                    <span className="text-muted-foreground">room {d.roomId}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(d.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </ConsoleShell>
  );
}
