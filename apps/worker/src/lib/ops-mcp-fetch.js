/**
 * JSON over the SSRF-guarded fetch, shared by the MCP OAuth and enterprise
 * (ID-JAG) flows. Every endpoint here comes from metadata or operator config,
 * so the host must still be in ALLOWED_SSRF_HOSTS.
 */
import { safeOutboundFetch } from "./url-ssrf.js";

const FETCH_TIMEOUT_MS = 8000;
const MAX_RESPONSE_CHARS = 200000;

export async function fetchJson(url, init = {}, env, { timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await safeOutboundFetch(url, { ...init, signal: controller.signal }, env);
    const text = (await response.text().catch(() => "")).slice(0, MAX_RESPONSE_CHARS);
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return { ok: response.ok, status: response.status, json: body };
  } catch (err) {
    const message = String(err?.message || err);
    if (message.includes("ssrf_")) return { ok: false, status: 0, json: null, error: message.slice(0, 60) };
    if (err?.name === "AbortError") return { ok: false, status: 0, json: null, error: "timeout" };
    return { ok: false, status: 0, json: null, error: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
