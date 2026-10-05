"use client";

import { useState } from "react";

export function DsaReportForm() {
  const [explanation, setExplanation] = useState("");
  const [url, setUrl] = useState("");
  const [contact, setContact] = useState("");
  const [goodFaith, setGoodFaith] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/dsa-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ explanation, url, contact, goodFaith }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setStatus("err");
        setError(data.error || `http_${res.status}`);
        return;
      }
      setStatus("ok");
    } catch {
      setStatus("err");
      setError("network");
    }
  }

  if (status === "ok") {
    return (
      <p className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm">
        We logged the notice. If the URL was a public share token we try to disable that token without
        minting a new one. Room data can still exist for the operator. This is not a court order.
      </p>
    );
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={onSubmit}>
      <label className="block text-sm">
        <span className="font-medium">Exact URL</span>
        <input
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://fluxychat.com/share/"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Why this is illegal (at least 20 characters)</span>
        <textarea
          className="mt-1 min-h-32 w-full rounded-md border border-border bg-background px-3 py-2"
          required
          minLength={20}
          maxLength={8000}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Your email or other contact</span>
        <input
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
          required
          minLength={3}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={goodFaith}
          onChange={(e) => setGoodFaith(e.target.checked)}
          required
        />
        <span>I believe this notice is accurate and submitted in good faith.</span>
      </label>
      {status === "err" ? (
        <p className="text-sm text-red-600" role="alert">
          Could not send ({error}). Try again or email fluxychat@outlook.com.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {status === "sending" ? "Sending..." : "Submit notice"}
      </button>
    </form>
  );
}
