/**
 * SSRF protection for outbound HTTP from the worker.
 *
 * ============================================================
 * !! RESIDUAL RISK  READ BEFORE ADDING A NEW CALL SITE !!
 * ============================================================
 *
 * Cloudflare Workers **cannot perform in-process DNS resolution** before
 * `fetch()`. This means a public hostname like `attacker-controlled.com`
 * that resolves to a private IP (e.g. 169.254.169.254 to read AWS IMDS)
 * will **slip through** every check in this file.
 *
 * The mitigations below reduce the attack surface but DO NOT eliminate it:
 *  1. Protocol allowlist (http/https only)
 *  2. Blocklist of well-known DNS-based SSRF vectors
 *     (nip.io, sslip.io, localtest.me, vcap.me, etc.)
 *  3. Static block of RFC-1918 + link-local + loopback + IPv6 ULA ranges
 *  4. Reject numeric IPv4, bracketed hostnames, mixed-encoding
 *  5. Operator allowlist via env `ALLOWED_SSRF_HOSTS` (suffix match)
 *
 * What an attacker who controls DNS for a domain can still do:
 *  - Point `webhook.attacker.com` at 169.254.169.254 (AWS IMDS) and
 *    have the Worker try to fetch credentials.
 *  - Point it at 127.0.0.1 / ::1 and reach local services if the
 *    Worker is ever co-located with a service on the same network
 *    (Workers do not, today, but the deployment model can change).
 *
 * How to actually close the hole:
 *  - Restrict the API surface so untrusted users cannot register
 *    arbitrary webhook URLs. Treat any user-supplied URL as
 *    "attacker-controlled DNS" and require an operator-curated
 *    allowlist, or use Cloudflare's Workers `resolveDNS` once
 *    available in the runtime (currently it is not for general use).
 *  - Or, when calling a user-supplied URL, use a Workers RPC bound
 *    to a specific egress policy and an allowlisted IP set.
 *
 * Until then: this is a defence in depth, not a guarantee.
 *
 * Operator-facing knob: `ALLOWED_SSRF_HOSTS` in
 * `apps/worker/.dev.vars.example`.
 */


// Hostnames / suffixes known to resolve to private/loopback addresses
// via public DNS. These are commonly used to bypass IP-based SSRF filters.
const SSRF_DNS_TRICKS = [
  "nip.io",
  "sslip.io",
  "localtest.me",
  "lvh.me",
  "vcap.me",
  "lacolhost.com",
  "127-0-0-1.nip.io",
];

function isPrivateIpv4(a: number, b: number, c: number, d: number): boolean {
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a >= 224) return true;
  void c;
  void d;
  return false;
}

function isPrivateIpv4Parts(a: number, b: number, c: number, d: number): boolean {
  if (![a, b, c, d].every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    return true;
  }
  return isPrivateIpv4(a, b, c, d);
}

function isPrivateIpv4String(hostname: string): boolean {
  const decimalOnly = hostname.match(/^(\d+)$/);
  if (decimalOnly) {
    const n = Number(decimalOnly[1]);
    if (!Number.isFinite(n) || n < 0 || n > 0xffffffff) return true;
    const a = (n >>> 24) & 0xff;
    const b = (n >>> 16) & 0xff;
    const c = (n >>> 8) & 0xff;
    const d = n & 0xff;
    return isPrivateIpv4(a, b, c, d);
  }

  const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    return isPrivateIpv4Parts(
      Number(ipv4Match[1]),
      Number(ipv4Match[2]),
      Number(ipv4Match[3]),
      Number(ipv4Match[4]),
    );
  }
  return false;
}

function isPrivateIpv6String(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower.includes("[") && !lower.includes("]")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")) {
    return true;
  }
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4String(mapped[1]);
  const bracketMapped = lower.match(/^\[::ffff:(\d+\.\d+\.\d+\.\d+)\]$/);
  if (bracketMapped) return isPrivateIpv4String(bracketMapped[1]);
  if (lower === "::1" || lower === "[::1]") return true;
  return false;
}

function matchesDnsTrick(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  for (const suffix of SSRF_DNS_TRICKS) {
    if (lower === suffix || lower.endsWith("." + suffix)) return true;
  }
  return false;
}

function isOnAllowlist(hostname: string, allowlist: Set<string>): boolean {
  if (allowlist.size === 0) return false;
  const lower = hostname.toLowerCase();
  if (allowlist.has(lower)) return true;
  // Suffix match (allow `acme.com` to cover `chat.acme.com`).
  for (const allowed of allowlist) {
    if (lower.endsWith("." + allowed)) return true;
  }
  return false;
}

function readAllowlist(env: unknown): Set<string> {
  const raw = (env as { ALLOWED_SSRF_HOSTS?: string } | undefined)?.ALLOWED_SSRF_HOSTS;
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isPrivateUrl(urlString: string, env?: unknown): boolean {
  try {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname.toLowerCase();

    if (!["http:", "https:"].includes(parsed.protocol)) return true;

    if (isOnAllowlist(hostname, readAllowlist(env))) {
      return false; // explicit operator override
    }

    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname === "0.0.0.0"
    ) {
      return true;
    }

    if (/\.(local|internal|localhost)$/.test(hostname)) return true;
    if (hostname.includes("[")) return true;
    if (matchesDnsTrick(hostname)) return true;

    if (isPrivateIpv4String(hostname)) return true;
    if (isPrivateIpv6String(hostname)) return true;

    return false;
  } catch {
    return true;
  }
}

export function assertSafeOutboundUrl(urlString: string, env?: unknown): URL {
  if (isPrivateUrl(urlString, env)) {
    throw new Error("ssrf_blocked");
  }
  return new URL(urlString);
}

/** Max number of redirect hops we are willing to follow while re-validating each Location. */
const MAX_SAFE_REDIRECTS = 5;

export async function safeOutboundFetch(
  urlString: string,
  init?: RequestInit,
  env?: unknown,
): Promise<Response> {
  // Validate the initial target.
  assertSafeOutboundUrl(urlString, env);

  // SSRF redirect bypass (audit S-15b): the default redirect:"follow" would
  // let a validated public endpoint respond with a 3xx Location pointing at a
  // private address (e.g. 169.254.169.254, 127.0.0.1) and fetch would follow
  // it WITHOUT re-validation. We force manual redirect handling and re-check
  // every hop through assertSafeOutboundUrl(). Caller-supplied `redirect` is
  // overridden on purpose - it must not be possible to weaken this from a
  // call site.
  let currentUrl = urlString;
  for (let hop = 0; hop <= MAX_SAFE_REDIRECTS; hop += 1) {
    const response = await fetch(currentUrl, {
      ...init,
      redirect: "manual",
    });

    const status = response.status;
    const isRedirect =
      status >= 300 && status < 400 && response.headers.has("location");
    if (!isRedirect) {
      return response;
    }

    if (hop === MAX_SAFE_REDIRECTS) {
      throw new Error("ssrf_too_many_redirects");
    }

    // Resolve the Location relative to the current URL, then re-validate it.
    const location = response.headers.get("location") || "";
    let nextUrl: string;
    try {
      nextUrl = new URL(location, currentUrl).toString();
    } catch {
      throw new Error("ssrf_blocked");
    }
    // Throws "ssrf_blocked" if the redirect target is private/disallowed.
    assertSafeOutboundUrl(nextUrl, env);
    currentUrl = nextUrl;
  }

  // Unreachable: the loop either returns a non-redirect response or throws.
  throw new Error("ssrf_blocked");
}
