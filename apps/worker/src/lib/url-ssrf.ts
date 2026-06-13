/**
 * SSRF protection for outbound HTTP from the worker.
 */

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

export function isPrivateUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname.toLowerCase();

    if (!["http:", "https:"].includes(parsed.protocol)) return true;

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

    if (isPrivateIpv4String(hostname)) return true;
    if (isPrivateIpv6String(hostname)) return true;

    return false;
  } catch {
    return true;
  }
}

export function assertSafeOutboundUrl(urlString: string): URL {
  if (isPrivateUrl(urlString)) {
    throw new Error("ssrf_blocked");
  }
  return new URL(urlString);
}

export async function safeOutboundFetch(urlString: string, init?: RequestInit): Promise<Response> {
  assertSafeOutboundUrl(urlString);
  return fetch(urlString, init);
}
