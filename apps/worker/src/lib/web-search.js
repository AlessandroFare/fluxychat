/**
 * Live web search for [web-search] / [deep-research] composer prompts.
 * Uses Brave Search API when BRAVE_SEARCH_API_KEY (or WEB_SEARCH_API_KEY) is set.
 */

import { safeOutboundFetch } from "./url-ssrf.js";
import { logInfo, logError } from "./worker-log.js";

const SEARCH_TIMEOUT_MS = 12_000;

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

function searchApiKey(env) {
  return env.BRAVE_SEARCH_API_KEY || env.WEB_SEARCH_API_KEY || null;
}

/**
 * @param {import("../worker.js").Env} env
 * @param {string} query
 * @param {{ numResults?: number }} [opts]
 */
export async function performWebSearch(env, query, opts = {}) {
  const apiKey = searchApiKey(env);
  if (!apiKey) {
    return { ok: false, error: "web_search_not_configured", results: [] };
  }
  const q = String(query || "").trim();
  if (!q) {
    return { ok: false, error: "empty_query", results: [] };
  }

  const num = Math.min(Math.max(opts.numResults ?? 5, 1), 10);
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", q);
  url.searchParams.set("count", String(num));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const res = await safeOutboundFetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, error: `brave_http_${res.status}`, results: [] };
    }
    const data = await res.json();
    const web = data?.web?.results || [];
    const results = web.slice(0, num).map((row) => ({
      title: row.title || "",
      url: row.url || "",
      snippet: row.description || row.extra_snippets?.[0] || "",
    }));
    return { ok: true, query: q, results };
  } catch (err) {
    logError("web_search.failed", err, { query: q.slice(0, 80) });
    return { ok: false, error: err?.message || "web_search_failed", results: [] };
  } finally {
    clearTimeout(timer);
  }
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

/**
 * Build a system context block to inject before the LLM answers research prompts.
 * @param {import("../worker.js").Env} env
 * @param {string} userMessage
 * @param {"web-search"|"deep-research"} mode
 */
export async function buildWebSearchContext(env, userMessage, mode) {
  const query = extractResearchQuery(userMessage);
  if (!query) return null;

  const apiKey = searchApiKey(env);
  if (!apiKey) {
    logInfo("web_search.skipped_no_api_key", { mode });
    return [
      "The user requested a live web search, but BRAVE_SEARCH_API_KEY is not configured on the Worker.",
      "Do NOT claim you ran a web search. Say search is unavailable until the operator adds Brave Search API key.",
      `Intended query: ${query}`,
    ].join("\n");
  }

  const primary = await performWebSearch(env, query, { numResults: mode === "deep-research" ? 8 : 5 });
  if (!primary.ok) {
    return [
      "A web search was attempted but failed.",
      `Error: ${primary.error}`,
      "Tell the user search failed and answer from general knowledge with clear uncertainty.",
      `Query: ${query}`,
    ].join("\n");
  }

  let block = formatResultsForLlm(primary.results, primary.query || query);

  if (mode === "deep-research" && primary.results.length > 0) {
    const followUp = `${query} latest news updates`;
    const secondary = await performWebSearch(env, followUp, { numResults: 4 });
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
