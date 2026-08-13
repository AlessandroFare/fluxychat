import { browserOgPreview, isBrowserRunConfigured } from "./browser-run.js";
import { logInfo } from "./worker-log.js";
import { isPrivateUrl } from "./url-ssrf.js";

export function quotaResetInfo(now = new Date()) {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );
  const resetTs = Math.floor(next.getTime() / 1000);
  const currentTs = Math.floor(now.getTime() / 1000);
  return {
    resetsAt: next.toISOString(),
    retryAfterSeconds: Math.max(0, resetTs - currentTs),
  };
}

export function extractMentions(content) {
  const regex = /@([a-zA-Z0-9_:]+)/g;
  const mentions = new Set();
  let m;
  while ((m = regex.exec(content))) {
    mentions.add(m[1]);
  }
  return Array.from(mentions);
}

export function extractFirstUrl(content) {
  const regex = /(https?:\/\/[^\s]+)/i;
  const m = content.match(regex);
  return m ? m[1] : null;
}

function parseHtmlOgPreview(html, url) {
  const get = (re) => {
    const match = html.match(re);
    return match ? match[1].trim() : null;
  };
  const title =
    get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) ||
    get(/<title[^>]*>([^<]+)<\/title>/i);
  const description = get(
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i,
  );
  const image = get(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i,
  );
  return { title, description, imageUrl: image, url, source: "html_fetch" };
}

export async function fetchOgPreview(url, env, options = {}) {
  const projectId = options.projectId;
  const feature = options.feature || "og_preview";

  try {
    const { validateUrl, fetchUrlWithAudit, recordUrlFetchAudit } = await import("./url-fetch-audit.js");
    const validation = validateUrl(url, env);
    if (!validation.ok) {
      await recordUrlFetchAudit(env, {
        projectId,
        feature,
        url,
        outcome: "blocked",
        blockedReason: validation.reason,
      });
      logInfo("og_preview.blocked_ssrf", { url, reason: validation.reason });
      return null;
    }

    if (isBrowserRunConfigured(env)) {
      const browserPreview = await browserOgPreview(env, url);
      if (browserPreview?.title || browserPreview?.description || browserPreview?.imageUrl) {
        await recordUrlFetchAudit(env, {
          projectId,
          feature: "og_preview_browser",
          url,
          outcome: "success",
        });
        return browserPreview;
      }
    }

    const fetched = await fetchUrlWithAudit(env, { url, projectId, feature });
    if (!fetched.ok || !fetched.response) return null;

    const html = await fetched.response.text();
    const htmlPreview = parseHtmlOgPreview(html, url);
    if (htmlPreview.title || htmlPreview.description || htmlPreview.imageUrl) {
      return htmlPreview;
    }

    if (isBrowserRunConfigured(env)) {
      return (await browserOgPreview(env, url)) || null;
    }

    return htmlPreview;
  } catch {
    return null;
  }
}
