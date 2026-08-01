/**
 * Live web search for [web-search] / [deep-research] composer prompts.
 * Provider chain (default): Tavily → SearXNG (self-hosted, public URL + Basic Auth).
 */

import { safeOutboundFetch } from "./url-ssrf.js";
import { logInfo, logError } from "./worker-log.js";

const SEARCH_TIMEOUT_MS = 12_000;
const DEFAULT_PROVIDER_CHAIN = "tavily,searxng";

export function detectResearchMode(text) {
  if (typeof text !== "string") return null;
  if (/\[web-search\]/i.test(text)) return "web-search";
  if (/\[deep-research\]/i.test(text)) return "deep-research";
  return null;
}

/** Extract the user topic from a composer research prompt. */
export function extractResearchQuery(text) {
  if (typeof text !== "string") return "";
  const cleaned = text
    .replace(/^@[\w.-]+\s*/i, "")
    .replace(/\[(web-search|deep-research)\]\s*/i, "")
    .trim();
  const aboutMatch = cleaned.match(/(?:about|on):\s*(.+)/i);
  if (aboutMatch) {
    return aboutMatch[1]
      .replace(/\.\s*Summarize findings.*$/i, "")
      .replace(/\.\s*Structure your answer.*$/i, "")
      .trim();
  }
  return cleaned.replace(/^Search the web for current, factual information about\s*/i, "")
    .replace(/^Conduct thorough, multi-step research on:\s*/i, "")
    .replace(/\.\s*Summarize findings.*$/i, "")
    .replace(/\.\s*Structure your answer.*$/i, "")
    .trim();
}

export function resolveWebSearchProviders(env) {
  const raw = env.WEB_SEARCH_PROVIDER || DEFAULT_PROVIDER_CHAIN;
  return raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeResults(rows, limit) {
  return rows.slice(0, limit).map((row) => ({
    title: row.title || "",
    url: row.url || "",
    snippet: row.snippet || row.content || "",
  }));
}

/** SearXNG must be a public HTTPS URL — Workers cannot reach 127.0.0.1 on your VPS. */
export function isLocalhostUrl(rawUrl) {
  if (!rawUrl) return false;
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

/** @param {import("../worker.js").Env} env */
export function searxngAuthHeader(env) {
  const user = env.SEARXNG_BASIC_AUTH_USER?.trim();
  if (!user) return null;
  const pass = env.SEARXNG_BASIC_AUTH_PASS ?? "";
  return `Basic ${btoa(`${user}:${pass}`)}`;
}

function searxngRequestHeaders(env) {
  const headers = { Accept: "application/json" };
  const auth = searxngAuthHeader(env);
  if (auth) headers.Authorization = auth;
  return headers;
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    return await safeOutboundFetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function searchTavily(env, query, num, mode) {
  const apiKey = env.TAVILY_API_KEY || env.WEB_SEARCH_API_KEY || null;
  if (!apiKey) return { ok: false, error: "not_configured", results: [] };

  const res = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: num,
      search_depth: mode === "deep-research" ? "advanced" : "basic",
      include_answer: false,
    }),
  });

  if (!res.ok) {
    return { ok: false, error: `tavily_http_${res.status}`, results: [] };
  }

  const data = await res.json();
  const rows = (data?.results || []).map((row) => ({
    title: row.title,
    url: row.url,
    snippet: row.content || row.snippet || "",
  }));
  return { ok: true, query, results: normalizeResults(rows, num), provider: "tavily" };
}

async function searchSearxng(env, query, num) {
  const base = (env.SEARXNG_BASE_URL || env.SEARXNG_URL || "").replace(/\/$/, "");
  if (!base) return { ok: false, error: "not_configured", results: [] };
  if (isLocalhostUrl(base)) {
    logInfo("web_search.searxng_localhost_skipped", {
      hint: "Use a public URL (e.g. https://searxng.example.com) — Workers cannot reach 127.0.0.1",
    });
    return { ok: false, error: "searxng_localhost_unreachable", results: [] };
  }

  const url = new URL(`${base}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");

  const res = await fetchWithTimeout(url.toString(), {
    headers: searxngRequestHeaders(env),
  });
  if (!res.ok) {
    return { ok: false, error: `searxng_http_${res.status}`, results: [] };
  }

  const data = await res.json();
  const rows = (data?.results || []).map((row) => ({
    title: row.title,
    url: row.url,
    snippet: row.content || row.snippet || "",
  }));
  return { ok: true, query, results: normalizeResults(rows, num), provider: "searxng" };
}

async function searchBrave(env, query, num) {
  const apiKey = env.BRAVE_SEARCH_API_KEY || null;
  if (!apiKey) return { ok: false, error: "not_configured", results: [] };

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(num));

  const res = await fetchWithTimeout(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
  });
  if (!res.ok) {
    return { ok: false, error: `brave_http_${res.status}`, results: [] };
  }

  const data = await res.json();
  const web = data?.web?.results || [];
  const rows = web.map((row) => ({
    title: row.title,
    url: row.url,
    snippet: row.description || row.extra_snippets?.[0] || "",
  }));
  return { ok: true, query, results: normalizeResults(rows, num), provider: "brave" };
}

async function searchWithProvider(env, provider, query, num, mode) {
  switch (provider) {
    case "tavily":
      return searchTavily(env, query, num, mode);
    case "searxng":
      return searchSearxng(env, query, num);
    case "brave":
      return searchBrave(env, query, num);
    default:
      return { ok: false, error: "unknown_provider", results: [] };
  }
}

function isConfigured(env, provider) {
  switch (provider) {
    case "tavily":
      return Boolean(env.TAVILY_API_KEY || env.WEB_SEARCH_API_KEY);
    case "searxng": {
      const base = env.SEARXNG_BASE_URL || env.SEARXNG_URL || "";
      return Boolean(base) && !isLocalhostUrl(base);
    }
    case "brave":
      return Boolean(env.BRAVE_SEARCH_API_KEY);
    default:
      return false;
  }
}

/**
 * @param {import("../worker.js").Env} env
 * @param {string} query
 * @param {{ numResults?: number, mode?: "web-search"|"deep-research" }} [opts]
 */
export async function performWebSearch(env, query, opts = {}) {
  const q = String(query || "").trim();
  if (!q) {
    return { ok: false, error: "empty_query", results: [] };
  }

  const num = Math.min(Math.max(opts.numResults ?? 5, 1), 10);
  const mode = opts.mode || "web-search";
  const providers = resolveWebSearchProviders(env);
  let lastError = "web_search_not_configured";

  for (const provider of providers) {
    if (!isConfigured(env, provider)) continue;
    try {
      const result = await searchWithProvider(env, provider, q, num, mode);
      if (result.ok && result.results.length > 0) {
        logInfo("web_search.ok", { provider, query: q.slice(0, 80), count: result.results.length });
        return result;
      }
      if (result.error && result.error !== "not_configured") {
        lastError = result.error;
        logInfo("web_search.provider_failed", { provider, error: result.error });
      }
    } catch (err) {
      lastError = err?.message || "web_search_failed";
      logError("web_search.provider_error", err, { provider, query: q.slice(0, 80) });
    }
  }

  return { ok: false, error: lastError, results: [] };
}

function formatResultsForLlm(results, query) {
  if (!results.length) {
    return `Web search for "${query}" returned no results.`;
  }
  const lines = results.map(
    (r, i) =>
      `${i + 1}. **${r.title || "Untitled"}**\n   URL: ${r.url}\n   ${r.snippet || ""}`.trim(),
  );
  return `Web search results for "${query}":\n\n${lines.join("\n\n")}`;
}

function hasAnySearchProvider(env) {
  return resolveWebSearchProviders(env).some((provider) => isConfigured(env, provider));
}

/**
 * Build a system context block to inject before the LLM answers research prompts.
 * @param {import("../worker.js").Env} env
 * @param {string} userMessage
 * @param {"web-search"|"deep-research"} mode
 */
export async function buildWebSearchContext(env, userMessage, mode) {
  const query = extractResearchQuery(userMessage);
  if (!query) return null;

  if (!hasAnySearchProvider(env)) {
    logInfo("web_search.skipped_no_api_key", { mode });
    return [
      "The user requested a live web search, but no search provider is configured on the Worker.",
      "Set TAVILY_API_KEY (recommended), or SEARXNG_BASE_URL with a public HTTPS URL + Basic Auth.",
      "Do NOT claim you ran a web search. Say search is unavailable until the operator configures a provider.",
      `Intended query: ${query}`,
    ].join("\n");
  }

  const primary = await performWebSearch(env, query, {
    numResults: mode === "deep-research" ? 8 : 5,
    mode,
  });
  if (!primary.ok) {
    return [
      "A web search was attempted but failed across configured providers.",
      `Error: ${primary.error}`,
      "Tell the user search failed and answer from general knowledge with clear uncertainty.",
      `Query: ${query}`,
    ].join("\n");
  }

  let block = formatResultsForLlm(primary.results, primary.query || query);

  if (mode === "deep-research" && primary.results.length > 0) {
    const followUp = `${query} latest news updates`;
    const secondary = await performWebSearch(env, followUp, { numResults: 4, mode });
    if (secondary.ok && secondary.results.length) {
      block += `\n\n---\n\nAdditional results:\n\n${formatResultsForLlm(secondary.results, followUp)}`;
    }
  }

  return [
    "LIVE WEB SEARCH RESULTS (use these — do NOT say you cannot search the web):",
    block,
    "Cite source URLs inline. If results are thin, say so explicitly.",
  ].join("\n\n");
}
