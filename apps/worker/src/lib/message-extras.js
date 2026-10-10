/**
 * Ably-style message extras: JSON metadata plus string headers.
 * Headers live under `metadata_json.headers` so Art. 50 fields stay in the same column.
 */

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeMessageHeaders(value) {
  if (value == null) return { headers: undefined };
  if (!isPlainObject(value)) return { error: "invalid_headers" };
  /** @type {Record<string, string>} */
  const headers = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof key !== "string" || !key.trim()) continue;
    if (raw == null) continue;
    if (typeof raw !== "string" && typeof raw !== "number" && typeof raw !== "boolean") {
      return { error: "invalid_headers" };
    }
    headers[key] = String(raw);
  }
  return { headers };
}

export function sanitizeMessageMetadata(value) {
  if (value == null) return { metadata: undefined };
  if (!isPlainObject(value)) return { error: "invalid_metadata" };
  const metadata = { ...value };
  delete metadata.headers;
  return { metadata };
}

export function parseMetadataJson(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function splitMessageExtras(parsed) {
  if (!isPlainObject(parsed)) return { metadata: undefined, headers: undefined };
  const { headers: rawHeaders, ...rest } = parsed;
  const headers =
    rawHeaders && isPlainObject(rawHeaders)
      ? Object.fromEntries(Object.entries(rawHeaders).map(([key, value]) => [key, String(value)]))
      : undefined;
  const metadata = Object.keys(rest).length ? rest : undefined;
  return { metadata, headers };
}

export function parseOperationDetails(body) {
  if (!body || typeof body !== "object") return { operation: undefined };
  const description =
    typeof body.description === "string"
      ? body.description.slice(0, 256)
      : typeof body.operation?.description === "string"
        ? body.operation.description.slice(0, 256)
        : undefined;
  const rawMeta = body.operationMetadata ?? body.operation?.metadata;
  if (rawMeta != null && !isPlainObject(rawMeta)) return { error: "invalid_operation_metadata" };
  if (!description && !rawMeta) return { operation: undefined };
  return {
    operation: {
      ...(description ? { description } : {}),
      ...(rawMeta ? { metadata: rawMeta } : {}),
    },
  };
}

/** Stream `quoted_message_id` — citation, not a `parentId` thread. */
export function parseQuotedMessageId(body) {
  const raw =
    body?.quotedMessageId ??
    body?.quoted_message_id ??
    (body?.metadata && typeof body.metadata === "object" ? body.metadata.quotedMessageId : null);
  if (raw == null || raw === "") return null;
  const id = Number(raw);
  if (!Number.isFinite(id) || id < 1) return null;
  return Math.floor(id);
}

export function quotedMessageIdFromMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return null;
  return parseQuotedMessageId({ quotedMessageId: metadata.quotedMessageId });
}

export function mergeMessageExtras(existingJson, metadata, headers) {
  const base = parseMetadataJson(existingJson);
  const meta = sanitizeMessageMetadata(metadata);
  if (meta.error) return meta;
  const hdr = sanitizeMessageHeaders(headers);
  if (hdr.error) return hdr;
  const next = { ...base };
  if (meta.metadata) Object.assign(next, meta.metadata);
  if (hdr.headers) next.headers = { ...(isPlainObject(next.headers) ? next.headers : {}), ...hdr.headers };
  return {
    json: Object.keys(next).length ? JSON.stringify(next) : null,
    extras: splitMessageExtras(next),
  };
}
