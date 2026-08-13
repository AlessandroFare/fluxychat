"use client";

import React, { useState } from "react";
import { Section, Button, Input, Textarea, Banner } from "./ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { messageFromUnknown } from "@/lib/error-message";

const WORKER_URL = getPublicWorkerUrl();

type VerifyMode = "registered" | "raw" | "batch";

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function WebhookPlaygroundCard() {
  const [mode, setMode] = useState<VerifyMode>("registered");
  const [webhookId, setWebhookId] = useState("");
  const [secret, setSecret] = useState("");
  const [payload, setPayload] = useState(
    JSON.stringify({ event: "message.created", roomId: "demo-room" }, null, 2),
  );
  const [batchEvents, setBatchEvents] = useState(
    JSON.stringify(
      [
        { event: "room.occupied", roomId: "demo-room" },
        { event: "room.vacated", roomId: "demo-room" },
      ],
      null,
      2,
    ),
  );
  const [signature, setSignature] = useState("");
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signLocally() {
    setError(null);
    setVerifyResult(null);
    try {
      const body = mode === "batch" ? batchEvents : payload;
      const hex = await hmacSha256Hex(secret, body);
      setSignature(`sha256=${hex}`);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Sign failed"));
    }
  }

  async function verifyOnWorker() {
    setBusy(true);
    setError(null);
    setVerifyResult(null);
    try {
      if (mode === "registered") {
        if (!webhookId.trim()) {
          setError("Webhook id required for server verify.");
          return;
        }
        const json = await fetchWorkerJson<{ valid?: boolean }>(
          `${WORKER_URL}/webhooks/verify`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              webhookId: webhookId.trim(),
              secret,
              payload,
              signature: signature.replace(/^sha256=/, ""),
            }),
          },
        );
        setVerifyResult(json.valid ? "Signature valid" : "Signature invalid");
        return;
      }

      if (!secret.trim() || !signature.trim()) {
        setError("Secret and signature required.");
        return;
      }

      if (mode === "raw") {
        const json = await fetchWorkerJson<{ valid?: boolean; mode?: string }>(
          `${WORKER_URL}/webhooks/verify-batch`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret,
              body: payload,
              signature: signature.replace(/^sha256=/, ""),
            }),
          },
        );
        setVerifyResult(
          json.valid ? `Valid (${json.mode ?? "raw_body"})` : "Signature invalid",
        );
        return;
      }

      const events = JSON.parse(batchEvents) as unknown[];
      const json = await fetchWorkerJson<{
        valid?: boolean;
        mode?: string;
        batchSignatureValid?: boolean;
        results?: { index: number; valid: boolean }[];
      }>(`${WORKER_URL}/webhooks/verify-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret,
          events,
          signature: signature.replace(/^sha256=/, ""),
        }),
      });
      const perEvent = json.results?.filter((r) => !r.valid).length ?? 0;
      setVerifyResult(
        json.valid
          ? `Batch valid (${json.mode ?? "batch"})`
          : `Batch invalid: ${perEvent} event(s) failed`,
      );
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Verify failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Webhook playground"
      description="Sign payloads locally (HMAC-SHA256) and verify against a registered webhook, a raw secret, or a Pusher-style event batch."
    >
      {error ? <Banner variant="error">{error}</Banner> : null}
      {verifyResult ? <Banner variant="success">{verifyResult}</Banner> : null}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["registered", "Registered webhook"],
            ["raw", "Raw body + secret"],
            ["batch", "Event batch"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={mode === value ? "primary" : "outline"}
            onClick={() => {
              setMode(value);
              setSignature("");
              setVerifyResult(null);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="grid gap-3">
        {mode === "registered" ? (
          <Input
            value={webhookId}
            onChange={(e) => setWebhookId(e.target.value)}
            placeholder="Webhook id (POST /webhooks/verify)"
          />
        ) : null}
        <Input
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Signing secret"
          type="password"
        />
        {mode === "batch" ? (
          <Textarea
            value={batchEvents}
            onChange={(e) => setBatchEvents(e.target.value)}
            rows={8}
            className="font-mono text-xs"
            placeholder="JSON array of events"
          />
        ) : (
          <Textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={6}
            className="font-mono text-xs"
          />
        )}
        {signature ? (
          <p className="break-all font-mono text-xs text-muted-foreground">
            X-Fluxy-Signature / X-Pusher-Signature: {signature}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void signLocally()}>
            Sign locally
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={busy || !signature}
            onClick={() => void verifyOnWorker()}
          >
            Verify on worker
          </Button>
        </div>
      </div>
    </Section>
  );
}

