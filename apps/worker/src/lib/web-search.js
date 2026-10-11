/**
 * Live web search for [web-search] / [deep-research] composer prompts.
 * Provider chain (default): Tavily → SearXNG → Brave → Wikipedia (free fallback).
 */

import { safeOutboundFetch } from "./url-ssrf.js";
import { logInfo, logError } from "./worker-log.js";

const SEARCH_TIMEOUT_MS = 12_000;
/** Wikipedia first: always free. Paid/SaaS search only if the operator keys them. */
const DEFAULT_PROVIDER_CHAIN = "wikipedia,brave,tavily,searxng";
const MAX_QUERY_CHARS = 220;
const MAX_SNIPPET_CHARS = 160;
const MAX_WEB_RESULTS = 3;
const MAX_DEEP_RESULTS = 5;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_RE = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}\b/g;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER_RE = /\b(?:bearer|token|api[_-]?key|sk-|jwt)[=:\s][^\s]{8,}/gi;

export function detectResearchMode(text) {
  if (typeof text !== "string") return null;
  if (/\[web-search\]/i.test(text)) return "web-search";
  if (/\[deep-research\]/i.test(text)) return "deep-research";
  return null;
}

/** Extract the user topic from a composer research prompt. */
function stripTrailingInstruction(text) {
  const markers = [". Summarize findings", ". Structure your answer"];
  let out = text;
  for (const marker of markers) {
    const idx = out.toLowerCase().indexOf(marker.toLowerCase());
    if (idx >= 0) out = out.slice(0, idx);
  }
  return out.trim();
}

export function extractResearchQuery(text) {
  if (typeof text !== "string") return "";
  let cleaned = text.trim();
  if (cleaned.startsWith("@")) {
    const space = cleaned.indexOf(" ");
    cleaned = space === -1 ? "" : cleaned.slice(space + 1).trim();
  }
  cleaned = cleaned.replace("[web-search]", "").replace("[WEB-SEARCH]", "");
  cleaned = cleaned.replace("[deep-research]", "").replace("[DEEP-RESEARCH]", "").trim();
  const aboutIdx = /(?:about|on):\s*/i.exec(cleaned);
  if (aboutIdx) {
    return stripTrailingInstruction(cleaned.slice(aboutIdx.index + aboutIdx[0].length));
  }
  const prefixes = [
    "Search the web for current, factual information about ",
    "Conduct thorough, multi-step research on: ",
  ];
  for (const prefix of prefixes) {
    if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
      cleaned = cleaned.slice(prefix.length);
      break;
    }
  }
  return stripTrailingInstruction(cleaned);
}

/** Shrink composer/history research prompts so the LLM does not eat TPM on instructions. */
export function compactResearchUserMessage(text) {
  if (typeof text !== "string") return text;
  const mode = detectResearchMode(text);
  if (!mode) return text;
  const q = sanitizeSearchQuery(extractResearchQuery(text));
  if (!q) return text;
  return mode === "deep-research" ? `[deep-research] ${q}` : `[web-search] ${q}`;
}

/**
 * Strip PII/secrets and cap length before any search provider sees the query.
 * No extra LLM: Groq never receives emails/tokens for search rewrite.
 */
export function sanitizeSearchQuery(raw) {
  let text = String(raw || "");
  text = text.replace(JWT_RE, " ");
  text = text.replace(BEARER_RE, " ");
  text = text.replace(EMAIL_RE, " ");
  text = text.replace(SSN_RE, " ");
  text = text.replace(PHONE_RE, " ");
  text = text.replace(/https?:\/\/\S+/gi, " ");
  text = text.replace(/[^\p{L}\p{N}\s.+#-]/gu, " ");
  text = text.replace(/\s+/g, " ").trim();
  if (text.length > MAX_QUERY_CHARS) text = text.slice(0, MAX_QUERY_CHARS).trim();
  return text;
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
    case "wikipedia":
      return searchWikipedia(query, num);
    default:
      return { ok: false, error: "unknown_provider", results: [] };
  }
}

async function searchWikipedia(query, num) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", query);
  url.searchParams.set("srlimit", String(num));
  url.searchParams.set("format", "json");
  url.searchParams.set("utf8", "1");

  const res = await fetchWithTimeout(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "FluxyChat/1.0 (web-search; https://fluxychat.com)",
    },
  });
  if (!res.ok) return { ok: false, error: `wikipedia_http_${res.status}`, results: [] };
  const data = await res.json();
  const rows = (data?.query?.search || []).map((row) => ({
    title: row.title,
    url: wikipediaArticleUrl(row.title),
    snippet: stripTagsByIndex(row.snippet || ""),
  }));
  return { ok: true, query, results: normalizeResults(rows, num), provider: "wikipedia" };
}

function wikipediaArticleUrl(title) {
  const page = new URL("https://en.wikipedia.org/wiki/");
  page.pathname = `/wiki/${encodeURIComponent(String(title).replaceAll(" ", "_"))}`;
  return page.href;
}

function stripTagsByIndex(html) {
  let out = String(html || "");
  for (let guard = 0; guard < 512; guard += 1) {
    const open = out.indexOf("<");
    if (open === -1) return out.replace(/\s+/g, " ").trim();
    const close = out.indexOf(">", open + 1);
    if (close === -1) {
      out = out.slice(0, open) + out.slice(open + 1);
      continue;
    }
    out = `${out.slice(0, open)} ${out.slice(close + 1)}`;
  }
  return out.replace(/\s+/g, " ").trim();
}

async function fetchPageSnippets(urls, limit = 3) {
  const targets = urls.filter((u) => typeof u === "string" && /^https:\/\//i.test(u)).slice(0, limit);
  const snippets = [];
  for (const pageUrl of targets) {
    try {
      const res = await fetchWithTimeout(pageUrl, {
        headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "FluxyChat/1.0" },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const text = stripTagsByIndex(html).slice(0, 1600);
      if (text.length > 80) snippets.push({ url: pageUrl, text });
    } catch {
      /* skip */
    }
  }
  return snippets;
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
    case "wikipedia":
      return true;
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
  const q = sanitizeSearchQuery(query);
  if (!q) {
    return { ok: false, error: "empty_query", results: [] };
  }

  const defaultNum = opts.mode === "deep-research" ? MAX_DEEP_RESULTS : MAX_WEB_RESULTS;
  const num = Math.min(Math.max(opts.numResults ?? defaultNum, 1), MAX_DEEP_RESULTS);
  const mode = opts.mode || "web-search";
  const providers = resolveWebSearchProviders(env);
  let lastError = "web_search_not_configured";

  for (const provider of providers) {
    if (!isConfigured(env, provider)) continue;
    try {
      const result = await searchWithProvider(env, provider, q, num, mode);
      if (result.ok && result.results.length > 0) {
        logInfo("web_search.ok", { provider, query: q.slice(0, 40), count: result.results.length });
        return result;
      }
      if (result.error && result.error !== "not_configured") {
        lastError = result.error;
        logInfo("web_search.provider_failed", { provider, error: result.error });
      }
    } catch (err) {
      lastError = err?.message || "web_search_failed";
      logError("web_search.provider_error", err, { provider, query: q.slice(0, 40) });
    }
  }

  return { ok: false, error: lastError, results: [] };
}

function clipSnippet(text) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length <= MAX_SNIPPET_CHARS) return s;
  return `${s.slice(0, MAX_SNIPPET_CHARS).trim()}…`;
}

function formatResultsForLlm(results, query) {
  if (!results.length) {
    return `No results for "${query}".`;
  }
  const lines = results.map(
    (r, i) => `${i + 1}. ${r.title || "Untitled"} | ${r.url} | ${clipSnippet(r.snippet)}`,
  );
  return `Results for "${query}":\n${lines.join("\n")}`;
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
  const query = sanitizeSearchQuery(extractResearchQuery(userMessage));
  if (!query) return null;

  if (!hasAnySearchProvider(env)) {
    logInfo("web_search.skipped_no_api_key", { mode });
    return `Search unavailable. Query: ${query}`;
  }

  const primary = await performWebSearch(env, query, {
    numResults: mode === "deep-research" ? MAX_DEEP_RESULTS : MAX_WEB_RESULTS,
    mode,
  });
  if (!primary.ok) {
    return `Search failed (${primary.error}). Query: ${query}. Answer briefly from general knowledge and say it is not live search.`;
  }

  let block = formatResultsForLlm(primary.results, primary.query || query);

  const fetchPages = env.WEB_SEARCH_FETCH_PAGES === "1" || env.WEB_SEARCH_FETCH_PAGES === "true";
  if (mode === "deep-research" && fetchPages && primary.results.length > 0) {
    const extracts = await fetchPageSnippets(
      primary.results.map((row) => row.url),
      2,
    );
    if (extracts.length > 0) {
      block += `\nExtracts:\n${extracts
        .map((row) => `${row.url}: ${clipSnippet(row.text)}`)
        .join("\n")}`;
    }
  }

  return `Live search. Cite URLs. Max 8 sentences.\n${block}`;
}
