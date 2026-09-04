/**
 * Declared room extension slots (kv / counter). Not eval.
 * Max 5 slots, 16 KiB JSON each, stored on the canonical room Durable Object.
 */

export const ROOM_EXT_PREFIX = "ext:";
export const ROOM_EXT_MAX_SLOTS = 5;
export const ROOM_EXT_MAX_BYTES = 16 * 1024;

const KINDS = new Set(["kv", "counter"]);

export function extensionStorageKey(id) {
  return `${ROOM_EXT_PREFIX}${id}`;
}

export function isValidExtensionId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

/**
 * @param {Map<string, unknown> | { list?: Function, get?: Function }} storage
 */
export async function snapshotRoomExtensions(storage) {
  if (!storage) return {};
  const ext = {};
  if (typeof storage.list === "function") {
    const listed = await storage.list({ prefix: ROOM_EXT_PREFIX });
    const entries =
      listed instanceof Map
        ? listed.entries()
        : Object.entries(listed ?? {});
    for (const [key, value] of entries) {
      const id = String(key).slice(ROOM_EXT_PREFIX.length);
      if (!id) continue;
      ext[id] = value;
    }
    return ext;
  }
  if (typeof storage.get === "function" && typeof storage.keys === "function") {
    for (const key of storage.keys()) {
      if (!String(key).startsWith(ROOM_EXT_PREFIX)) continue;
      ext[String(key).slice(ROOM_EXT_PREFIX.length)] = await storage.get(key);
    }
  }
  return ext;
}

export function applyExtensionWrite(current, body) {
  const kind =
    body?.kind === "counter" || current?.kind === "counter" ? "counter" : "kv";
  if (kind === "counter") {
    const base =
      typeof current?.data === "number"
        ? current.data
        : typeof body?.data === "number"
          ? body.data
          : 0;
    const delta = typeof body?.delta === "number" ? body.delta : 0;
    const next = Number.isFinite(base + delta) ? base + delta : base;
    return { kind: "counter", data: next, updatedAt: new Date().toISOString() };
  }
  return {
    kind: "kv",
    data: body?.data === undefined ? (current?.data ?? null) : body.data,
    updatedAt: new Date().toISOString(),
  };
}

export function validateExtensionWrite({ id, body, existing, declared }) {
  if (!isValidExtensionId(id)) return { ok: false, error: "invalid_extension_id", status: 400 };
  const kind = body?.kind ?? existing?.kind ?? "kv";
  if (!KINDS.has(kind)) return { ok: false, error: "invalid_extension_kind", status: 400 };
  if (Array.isArray(declared) && declared.length > 0) {
    const slot = declared.find((s) => s.id === id);
    if (!slot) return { ok: false, error: "undeclared_extension", status: 403 };
    if (slot.kind && slot.kind !== kind && !existing) {
      return { ok: false, error: "extension_kind_mismatch", status: 400 };
    }
  }
  const next = applyExtensionWrite(existing, { ...body, kind });
  const bytes = new TextEncoder().encode(JSON.stringify(next)).length;
  if (bytes > ROOM_EXT_MAX_BYTES) return { ok: false, error: "extension_too_large", status: 413 };
  return { ok: true, record: next };
}

export async function putRoomExtension(storage, id, body, declared) {
  const existing = await storage.get(extensionStorageKey(id));
  const snapshot = await snapshotRoomExtensions(storage);
  const isNew = existing == null;
  if (isNew && Object.keys(snapshot).length >= ROOM_EXT_MAX_SLOTS) {
    return { ok: false, error: "extension_slot_limit", status: 400 };
  }
  const checked = validateExtensionWrite({ id, body, existing, declared });
  if (!checked.ok) return checked;
  await storage.put(extensionStorageKey(id), checked.record);
  const ext = await snapshotRoomExtensions(storage);
  return { ok: true, id, record: checked.record, ext };
}
