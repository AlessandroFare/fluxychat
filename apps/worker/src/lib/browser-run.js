/**
 * Cloudflare Browser Run Quick Actions (P12-K).
 */
import { isPrivateUrl } from "./url-ssrf.js";
import { logInfo } from "./worker-log.js";

/**
 * @param {*} env
 */
export function isBrowserRunConfigured(env) {
  return typeof env?.BROWSER?.quickAction === "function";
}

/**
 * @param {unknown} result
 */
function extractQuickActionText(result) {
  if (typeof result === "string") return result.trim();
  if (result instanceof ArrayBuffer) {
    return new TextDecoder().decode(result).trim();
  }
  if (result && typeof result === "object") {
    const obj = /** @type {Record<string, unknown>} */ (result);
    for (const key of ["markdown", "content", "text", "html"]) {
      if (typeof obj[key] === "string" && obj[key].trim()) {
        return obj[key].trim();
      }
    }
  }
  return "";
}

/**
 * @param {string} markdown
 */
function parseMarkdownOg(markdown) {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() || null;
  const imageMatch = markdown.match(/!\[[^\]]*\]\(([^)]+)\)/);
  const imageUrl = imageMatch?.[1]?.trim() || null;
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("!["));
  const description = lines[0]?.slice(0, 280) || null;
  return { title, description, imageUrl };
}

/**
 * @param {*} env
 * @param {string} url
 */
export async function browserMarkdownForUrl(env, url) {
  if (!isBrowserRunConfigured(env)) {
    return { ok: false, error: "browser_not_configured" };
  }
  if (isPrivateUrl(url)) {
    return { ok: false, error: "ssrf_blocked" };
  }

  try {
    const result = await env.BROWSER.quickAction("markdown", { url });
    const markdown = extractQuickActionText(result);
    if (!markdown) {
      return { ok: false, error: "browser_empty_markdown" };
    }
    return { ok: true, markdown };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * OG preview via Browser Run markdown extraction (SPA-safe).
 *
 * @param {*} env
 * @param {string} url
 */
export async function browserOgPreview(env, url) {
  const markdownResult = await browserMarkdownForUrl(env, url);
  if (!markdownResult.ok) return null;

  const parsed = parseMarkdownOg(markdownResult.markdown);
  logInfo("og_preview.browser_run", { url, hasTitle: Boolean(parsed.title) });
  return {
    title: parsed.title,
    description: parsed.description,
    imageUrl: parsed.imageUrl,
    url,
    source: "browser_run",
  };
}

/**
 * @param {*} env
 * @param {string} url
 */
export async function browserScreenshotBytes(env, url) {
  if (!isBrowserRunConfigured(env)) {
    return { ok: false, error: "browser_not_configured" };
  }
  if (isPrivateUrl(url)) {
    return { ok: false, error: "ssrf_blocked" };
  }

  try {
    const result = await env.BROWSER.quickAction("screenshot", { url });
    if (result instanceof ArrayBuffer) {
      return { ok: true, bytes: new Uint8Array(result), contentType: "image/png" };
    }
    if (result instanceof Uint8Array) {
      return { ok: true, bytes: result, contentType: "image/png" };
    }
    return { ok: false, error: "browser_invalid_screenshot" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
