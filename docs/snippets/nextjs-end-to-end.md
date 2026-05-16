# Snippet: Next.js end-to-end (App Router)

Obiettivo: un’integrazione “copy‑paste” che:

- minta un **JWT** dal backend Next.js (usando API key server-side)
- renderizzi una pagina client che si connette alla room e invia messaggi (SDK)

## 1) `.env.local` (Next.js)

Metti queste env nel tuo progetto Next.js:

```bash
NEXT_PUBLIC_FLUXYCHAT_WORKER_URL="http://127.0.0.1:8787"
FLUXY_BASE_URL="http://127.0.0.1:8787"
FLUXY_API_KEY="fc_..."
```

Note:

- `NEXT_PUBLIC_*` e leggibile nel browser (ok per base URL).
- **NON** esporre `FLUXY_API_KEY` nel client: resta solo server-side.

## 2) Route handler per mint JWT

Crea `app/api/fluxy/token/route.ts`:

```ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const userId = body?.userId;
  if (!userId)
    return NextResponse.json({ error: "userId required" }, { status: 400 });

  const roles = Array.isArray(body?.roles) && body.roles.length ? body.roles : ["member"];

  const res = await fetch(`${process.env.FLUXY_BASE_URL}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Fluxy-Api-Key": process.env.FLUXY_API_KEY!,
    },
    body: JSON.stringify({ userId, roles, ttlSeconds: 3600 }),
  });

  const json = await res.json().catch(() => ({}));
  return NextResponse.json(json, { status: res.status });
}
```

## 3) Pagina chat (client) con SDK

Crea `app/fluxy-demo/page.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { FluxyChatClient, useChat } from "@fluxychat/sdk";

export default function FluxyDemoPage() {
  const baseUrl = process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL!;
  const [userId, setUserId] = useState("alice");
  const [roomId, setRoomId] = useState("public-demo-room");
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadToken() {
      const res = await fetch("/api/fluxy/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, roles: ["member"] }),
      });
      const json = await res.json();
      if (!cancelled) setToken(json?.token ?? null);
    }
    loadToken().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const client = useMemo(() => {
    if (!token) return null;
    return new FluxyChatClient({ baseUrl, userId, token });
  }, [baseUrl, token, userId]);

  const { messages, sendMessage, connectionStatus } = useChat({
    roomId,
    client: client ?? undefined,
  });

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Fluxychat demo</h1>
      <p>status: {connectionStatus}</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <label>
          userId{" "}
          <input value={userId} onChange={(e) => setUserId(e.target.value)} />
        </label>
        <label>
          roomId{" "}
          <input value={roomId} onChange={(e) => setRoomId(e.target.value)} />
        </label>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          height: 360,
          overflow: "auto",
          marginBottom: 12,
        }}
      >
        {messages.map((m) => (
          <div key={m.id} style={{ padding: "6px 0" }}>
            <b>{m.userId}</b>: {m.content}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const text = input.trim();
          if (!text) return;
          sendMessage(text);
          setInput("");
        }}
        style={{ display: "flex", gap: 8 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={!client}>
          Send
        </button>
      </form>
    </div>
  );
}
```

## 4) Note importanti

- La room deve esistere e l’utente deve essere membro, altrimenti WS puo fallire con `403`.
- In produzione, il tuo backend dovrebbe decidere i ruoli (non il client).

