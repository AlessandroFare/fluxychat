/**
 * Custom hostname → project routing (P12-G).
 */

const HOSTNAME_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

const DOMAIN_STATUSES = new Set(["pending", "active", "disabled"]);

/**
 * @param {string} raw
 */
export function normalizeHostname(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .split(":")[0];
}

/**
 * @param {string} hostname
 * @param {*} env
 */
export function isPlatformWorkerHostname(hostname, env) {
  const host = normalizeHostname(hostname);
  if (!host || host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".workers.dev")) return true;

  const fromEnv = String(
    env.WORKER_PLATFORM_HOSTS || env.PLATFORM_WORKER_HOSTS || "",
  )
    .split(",")
    .map((s) => normalizeHostname(s))
    .filter(Boolean);

  return fromEnv.includes(host);
}

/**
 * @param {string | null | undefined} raw
 */
export function parseAllowedOriginsField(raw) {
  if (!raw) return [];
  const trimmed = String(raw).trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed)
        ? parsed.map((o) => String(o).trim()).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }
  return trimmed
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * @param {*} row
 */
export function mapCustomDomainRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    hostname: row.hostname,
    defaultRoomId: row.default_room_id ?? null,
    brandName: row.brand_name ?? null,
    brandLogoUrl: row.brand_logo_url ?? null,
    allowedOrigins: parseAllowedOriginsField(row.allowed_origins),
    status: row.status,
    verifiedAt: row.verified_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * @param {*} env
 * @param {string} hostname
 */
export async function lookupActiveCustomDomain(env, hostname) {
  const h = normalizeHostname(hostname);
  if (!h || !HOSTNAME_RE.test(h)) return null;
  if (isPlatformWorkerHostname(h, env)) return null;

  const row = await env.DB.prepare(
    `SELECT * FROM project_custom_domains
     WHERE hostname = ? AND status = 'active' LIMIT 1`,
  )
    .bind(h)
    .first();

  return row ? mapCustomDomainRow(row) : null;
}

/**
 * @param {*} env
 * @param {string} hostname
 */
export async function resolveCustomDomainContext(env, hostname) {
  return lookupActiveCustomDomain(env, hostname);
}

/**
 * @param {*} env
 * @param {import('./custom-domains.js').ReturnType<typeof mapCustomDomainRow> | null} hostCtx
 */
export function buildAllowedOriginsList(env, hostCtx) {
  const base = (env.ALLOWED_ORIGINS || "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (base.includes("*")) return ["*"];

  const merged = new Set(base);
  if (hostCtx?.hostname) {
    merged.add(`https://${hostCtx.hostname}`);
    for (const origin of hostCtx.allowedOrigins || []) merged.add(origin);
  }
  return [...merged];
}

/**
 * @param {string} hostname
 */
export function validateCustomHostname(hostname) {
  const h = normalizeHostname(hostname);
  if (!h) return { ok: false, error: "hostname_required" };
  if (h.length > 253) return { ok: false, error: "hostname_too_long" };
  if (!HOSTNAME_RE.test(h)) return { ok: false, error: "invalid_hostname" };
  if (h.startsWith("www.")) {
    return { ok: false, error: "use_apex_or_subdomain_without_www" };
  }
  return { ok: true, hostname: h };
}

/**
 * @param {*} env
 * @param {string} projectId
 */
export async function listCustomDomainsForProject(env, projectId) {
  const rows = await env.DB.prepare(
    `SELECT * FROM project_custom_domains
     WHERE project_id = ?
     ORDER BY created_at DESC`,
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapCustomDomainRow);
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   hostname: string,
 *   defaultRoomId?: string | null,
 *   brandName?: string | null,
 *   brandLogoUrl?: string | null,
 *   allowedOrigins?: string[],
 * }} input
 */
export async function createCustomDomain(env, input) {
  const validated = validateCustomHostname(input.hostname);
  if (!validated.ok) return validated;

  if (input.defaultRoomId) {
    const room = await env.DB.prepare(
      "SELECT id FROM rooms WHERE project_id = ? AND id = ? LIMIT 1",
    )
      .bind(input.projectId, input.defaultRoomId)
      .first();
    if (!room) return { ok: false, error: "default_room_not_found" };
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const origins = Array.isArray(input.allowedOrigins)
    ? JSON.stringify(input.allowedOrigins.slice(0, 20))
    : null;

  try {
    await env.DB.prepare(
      `INSERT INTO project_custom_domains
         (id, project_id, hostname, default_room_id, brand_name, brand_logo_url,
          allowed_origins, status, verified_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)`,
    )
      .bind(
        id,
        input.projectId,
        validated.hostname,
        input.defaultRoomId ?? null,
        input.brandName?.slice(0, 120) ?? null,
        input.brandLogoUrl?.slice(0, 512) ?? null,
        origins,
        now,
        now,
      )
      .run();
  } catch (err) {
    if (String(err?.message || err).includes("UNIQUE")) {
      return { ok: false, error: "hostname_taken" };
    }
    throw err;
  }

  return {
    ok: true,
    domain: mapCustomDomainRow({
      id,
      project_id: input.projectId,
      hostname: validated.hostname,
      default_room_id: input.defaultRoomId ?? null,
      brand_name: input.brandName ?? null,
      brand_logo_url: input.brandLogoUrl ?? null,
      allowed_origins: origins,
      status: "pending",
      verified_at: null,
      created_at: now,
      updated_at: now,
    }),
  };
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   domainId: string,
 *   status?: string,
 *   defaultRoomId?: string | null,
 *   brandName?: string | null,
 *   brandLogoUrl?: string | null,
 *   allowedOrigins?: string[],
 * }} input
 */
export async function updateCustomDomain(env, input) {
  const row = await env.DB.prepare(
    "SELECT * FROM project_custom_domains WHERE id = ? AND project_id = ?",
  )
    .bind(input.domainId, input.projectId)
    .first();
  if (!row) return { ok: false, error: "not_found" };

  const now = new Date().toISOString();
  const status =
    input.status && DOMAIN_STATUSES.has(input.status) ? input.status : row.status;
  const verifiedAt =
    status === "active" && row.status !== "active" ? now : row.verified_at;

  const allowedOrigins =
    input.allowedOrigins !== undefined
      ? JSON.stringify(input.allowedOrigins.slice(0, 20))
      : row.allowed_origins;

  await env.DB.prepare(
    `UPDATE project_custom_domains SET
       status = ?,
       default_room_id = COALESCE(?, default_room_id),
       brand_name = COALESCE(?, brand_name),
       brand_logo_url = COALESCE(?, brand_logo_url),
       allowed_origins = ?,
       verified_at = ?,
       updated_at = ?
     WHERE id = ? AND project_id = ?`,
  )
    .bind(
      status,
      input.defaultRoomId ?? null,
      input.brandName?.slice(0, 120) ?? null,
      input.brandLogoUrl?.slice(0, 512) ?? null,
      allowedOrigins,
      verifiedAt,
      now,
      input.domainId,
      input.projectId,
    )
    .run();

  const updated = await env.DB.prepare(
    "SELECT * FROM project_custom_domains WHERE id = ?",
  )
    .bind(input.domainId)
    .first();

  return { ok: true, domain: mapCustomDomainRow(updated) };
}

/**
 * @param {*} env
 * @param {{ projectId: string, domainId: string }} input
 */
export async function deleteCustomDomain(env, input) {
  const result = await env.DB.prepare(
    "DELETE FROM project_custom_domains WHERE id = ? AND project_id = ?",
  )
    .bind(input.domainId, input.projectId)
    .run();
  if (!result.meta?.changes) return { ok: false, error: "not_found" };
  return { ok: true };
}

/**
 * Public host config for white-label clients.
 * @param {*} env
 * @param {string} hostname
 */
export async function getPublicHostConfig(env, hostname) {
  const ctx = await lookupActiveCustomDomain(env, hostname);
  if (!ctx) return null;
  return {
    projectId: ctx.projectId,
    hostname: ctx.hostname,
    defaultRoomId: ctx.defaultRoomId,
    brand: {
      name: ctx.brandName,
      logoUrl: ctx.brandLogoUrl,
    },
  };
}
