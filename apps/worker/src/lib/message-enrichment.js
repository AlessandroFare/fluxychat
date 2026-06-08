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
  const regex = /@([a-zA-Z0-9_]+)/g;
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

export async function fetchOgPreview(url, env) {
  try {
    if (isPrivateUrl(url)) {
      logInfo("og_preview.blocked_ssrf", { url });
      return null;
    }

    if (isBrowserRunConfigured(env)) {
      const browserPreview = await browserOgPreview(env, url);
      if (browserPreview?.title || browserPreview?.description || browserPreview?.imageUrl) {
        return browserPreview;
      }
    }

    const res = await fetch(url);
    const html = await res.text();
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
