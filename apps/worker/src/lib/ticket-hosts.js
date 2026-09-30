/**
 * Fixed API hosts for GitHub / Linear / Jira. No operator-supplied fetch URL
 * except a Jira site hostname that must end with .atlassian.net.
 */

const GITHUB_API = "api.github.com";
const LINEAR_API = "api.linear.app";

export function isAtlassianSiteHost(hostname) {
  const h = String(hostname || "")
    .trim()
    .toLowerCase();
  return h.endsWith(".atlassian.net") && h.split(".").length >= 3;
}

export function githubIssuesUrl(ownerRepo) {
  return `https://${GITHUB_API}/repos/${ownerRepo}/issues`;
}

export function linearGraphqlUrl() {
  return `https://${LINEAR_API}/graphql`;
}

export function jiraIssueUrl(base) {
  const cleaned = String(base || "")
    .trim()
    .replace(/\/+$/, "");
  return `${cleaned}/rest/api/3/issue`;
}

export function assertTicketFetchUrl(provider, urlString) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error("ticket_url_invalid");
  }
  if (url.protocol !== "https:") throw new Error("ticket_https_only");
  const host = url.hostname.toLowerCase();
  if (provider === "github") {
    if (host !== GITHUB_API) throw new Error("ticket_host_blocked");
    return url;
  }
  if (provider === "linear") {
    if (host !== LINEAR_API) throw new Error("ticket_host_blocked");
    return url;
  }
  if (provider === "jira") {
    if (!isAtlassianSiteHost(host)) throw new Error("jira_host_not_atlassian");
    return url;
  }
  throw new Error("unknown_provider");
}

export function parseJiraBaseUrl(raw) {
  const cleaned = String(raw || "")
    .trim()
    .replace(/\/+$/, "");
  if (!cleaned) return { ok: false, error: "jira_env_missing" };
  try {
    const url = new URL(cleaned.includes("://") ? cleaned : `https://${cleaned}`);
    if (url.protocol !== "https:") return { ok: false, error: "ticket_https_only" };
    if (!isAtlassianSiteHost(url.hostname)) return { ok: false, error: "jira_host_not_atlassian" };
    return { ok: true, base: `https://${url.hostname}` };
  } catch {
    return { ok: false, error: "jira_env_missing" };
  }
}
