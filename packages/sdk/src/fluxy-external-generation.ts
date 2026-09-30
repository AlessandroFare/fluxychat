function workerOrigin(url: string) {
  return String(url || "").replace(/\/+$/, "");
}

function parseJsonBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function messageIdFromGenerationBody(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const rec = body as { message?: { id?: unknown }; id?: unknown };
  const raw = rec.message?.id ?? rec.id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function errorFromBody(body: unknown, status: number) {
  if (body && typeof body === "object" && "error" in body) {
    return String((body as { error?: string }).error);
  }
  return `http_${status}`;
}

export async function publishExternalGenerationToRoom(options: {
  workerUrl: string;
  token: string;
  roomId: string;
  content: string;
  replyTo?: number | null;
  fetchImpl?: typeof fetch;
}): Promise<
  | { ok: true; status: number; body: unknown; messageId: number | null }
  | { ok: false; status: number; error: string }
> {
  const content = String(options.content || "").trim();
  const roomId = String(options.roomId || "").trim();
  if (!content || !roomId) return { ok: false, status: 400, error: "room_and_content_required" };
  const fetchImpl = options.fetchImpl ?? fetch;
  const res = await fetchImpl(`${workerOrigin(options.workerUrl)}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.token}`,
    },
    body: JSON.stringify({
      roomId,
      content,
      replyTo: options.replyTo ?? null,
    }),
  });
  const body = parseJsonBody(await res.text());
  if (!res.ok) {
    return { ok: false, status: res.status, error: errorFromBody(body, res.status) };
  }
  return { ok: true, status: res.status, body, messageId: messageIdFromGenerationBody(body) };
}

export async function editExternalGenerationInRoom(options: {
  workerUrl: string;
  token: string;
  messageId: number;
  content: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; status: number } | { ok: false; status: number; error: string }> {
  const messageId = Number(options.messageId);
  const content = String(options.content || "");
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return { ok: false, status: 400, error: "message_id_required" };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const res = await fetchImpl(
    `${workerOrigin(options.workerUrl)}/messages/${encodeURIComponent(String(messageId))}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.token}`,
      },
      body: JSON.stringify({ content }),
    },
  );
  if (!res.ok) {
    const body = parseJsonBody(await res.text());
    return { ok: false, status: res.status, error: errorFromBody(body, res.status) };
  }
  return { ok: true, status: res.status };
}

/**
 * POST the first non-empty prefix, then PATCH the same row as more chunks arrive.
 * Room WS sees message edits. The Agent Durable Object is unused. Not Inngest-hosted streaming.
 */
export async function publishExternalGenerationChunksToRoom(options: {
  workerUrl: string;
  token: string;
  roomId: string;
  chunks: AsyncIterable<string> | Iterable<string>;
  replyTo?: number | null;
  fetchImpl?: typeof fetch;
}): Promise<
  | { ok: true; messageId: number; content: string }
  | { ok: false; status: number; error: string }
> {
  let acc = "";
  let messageId: number | null = null;
  for await (const piece of options.chunks) {
    acc += String(piece ?? "");
    if (!acc.trim()) continue;
    if (messageId == null) {
      const created = await publishExternalGenerationToRoom({
        workerUrl: options.workerUrl,
        token: options.token,
        roomId: options.roomId,
        content: acc,
        replyTo: options.replyTo,
        fetchImpl: options.fetchImpl,
      });
      if (!created.ok) return created;
      messageId = created.messageId;
      if (messageId == null) {
        return { ok: false, status: 502, error: "create_missing_message_id" };
      }
      continue;
    }
    const edited = await editExternalGenerationInRoom({
      workerUrl: options.workerUrl,
      token: options.token,
      messageId,
      content: acc,
      fetchImpl: options.fetchImpl,
    });
    if (!edited.ok) return edited;
  }
  if (messageId == null) {
    return { ok: false, status: 400, error: "room_and_content_required" };
  }
  return { ok: true, messageId, content: acc };
}
