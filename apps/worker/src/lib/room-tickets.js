/**
 * Create a GitHub / Linear / Jira ticket from a room.
 * Self-host: Worker env PATs. Hosted: per-project encrypted token only.
 */
import { hostedSharedWorkerPatForbidden } from "./hosted-saas-policy.js";
import { assertTicketFetchUrl, githubIssuesUrl, jiraIssueUrl, linearGraphqlUrl, parseJiraBaseUrl } from "./ticket-hosts.js";
import { safeOutboundFetch } from "./url-ssrf.js";
import { logInfo } from "./worker-log.js";
import { injectW3cTraceHeaders } from "./w3c-trace-context.js";

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

function ticketEnv(env, credentials) {
  if (!hostedSharedWorkerPatForbidden(env)) {
    return {
      ...env,
      GITHUB_TOKEN: credentials?.githubToken || env?.GITHUB_TOKEN,
      LINEAR_API_KEY: credentials?.linearApiKey || env?.LINEAR_API_KEY,
      JIRA_BASE_URL: credentials?.jiraBaseUrl || env?.JIRA_BASE_URL,
      JIRA_EMAIL: credentials?.jiraEmail || env?.JIRA_EMAIL,
      JIRA_API_TOKEN: credentials?.jiraApiToken || env?.JIRA_API_TOKEN,
    };
  }
  return {
    ...env,
    GITHUB_TOKEN: credentials?.githubToken || "",
    LINEAR_API_KEY: credentials?.linearApiKey || "",
    JIRA_BASE_URL: credentials?.jiraBaseUrl || "",
    JIRA_EMAIL: credentials?.jiraEmail || "",
    JIRA_API_TOKEN: credentials?.jiraApiToken || "",
  };
}

export async function createExternalTicket(env, input = {}) {
  const provider = str(input.provider).toLowerCase();
  const title = str(input.title).slice(0, 200);
  const body = str(input.body).slice(0, 8000);
  if (!title) return { ok: false, error: "title_required", status: 400 };

  if (hostedSharedWorkerPatForbidden(env) && !input.credentials) {
    return { ok: false, error: "hosted_project_token_required", status: 403 };
  }

  const footer = `\n\n---\nFrom FluxyChat room \`${str(input.roomId)}\``;
  const text = `${body}${footer}`;
  const useEnv = { ...ticketEnv(env, input.credentials), ticketTraceId: str(input.runId) || str(input.roomId) };

  if (provider === "github") {
    return createGitHubIssue(useEnv, { title, body: text, repo: str(input.repo) });
  }
  if (provider === "linear") {
    return createLinearIssue(useEnv, { title, body: text, teamId: str(input.teamId) });
  }
  if (provider === "jira") {
    return createJiraIssue(useEnv, { title, body: text, projectKey: str(input.projectKey) });
  }
  return { ok: false, error: "unknown_provider", status: 400 };
}

async function createGitHubIssue(env, { title, body, repo }) {
  const token = str(env?.GITHUB_TOKEN);
  if (!token) return { ok: false, error: "github_token_missing", status: 400 };
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) || repo.includes("..")) {
    return { ok: false, error: "invalid_repo", status: 400 };
  }
  const url = githubIssuesUrl(repo);
  assertTicketFetchUrl("github", url);
  const res = await safeOutboundFetch(
    url,
    {
      method: "POST",
      headers: injectW3cTraceHeaders(
        {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        { traceId: env?.ticketTraceId, spanId: repo },
      ),
      body: JSON.stringify({ title, body }),
    },
    env,
  );
  if (!res.ok) return { ok: false, error: `github_http_${res.status}`, status: 502 };
  const data = await res.json();
  logInfo("room_ticket.github", { repo, number: data.number });
  return { ok: true, ticket: { provider: "github", url: data.html_url, id: String(data.number) } };
}

async function createLinearIssue(env, { title, body, teamId }) {
  const token = str(env?.LINEAR_API_KEY);
  if (!token) return { ok: false, error: "linear_token_missing", status: 400 };
  if (!teamId) return { ok: false, error: "team_id_required", status: 400 };
  const url = linearGraphqlUrl();
  assertTicketFetchUrl("linear", url);
  const res = await safeOutboundFetch(
    url,
    {
      method: "POST",
      headers: injectW3cTraceHeaders(
        {
          Authorization: token,
          "Content-Type": "application/json",
        },
        { traceId: env?.ticketTraceId, spanId: teamId },
      ),
      body: JSON.stringify({
        query:
          "mutation IssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }",
        variables: { input: { title, description: body, teamId } },
      }),
    },
    env,
  );
  if (!res.ok) return { ok: false, error: `linear_http_${res.status}`, status: 502 };
  const data = await res.json();
  const issue = data?.data?.issueCreate?.issue;
  if (!data?.data?.issueCreate?.success || !issue?.url) {
    return { ok: false, error: "linear_create_failed", status: 502 };
  }
  logInfo("room_ticket.linear", { id: issue.identifier });
  return { ok: true, ticket: { provider: "linear", url: issue.url, id: issue.identifier } };
}

async function createJiraIssue(env, { title, body, projectKey }) {
  const parsed = parseJiraBaseUrl(env?.JIRA_BASE_URL);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };
  const email = str(env?.JIRA_EMAIL);
  const token = str(env?.JIRA_API_TOKEN);
  if (!email || !token) return { ok: false, error: "jira_env_missing", status: 400 };
  if (!projectKey) return { ok: false, error: "project_key_required", status: 400 };
  const url = jiraIssueUrl(parsed.base);
  assertTicketFetchUrl("jira", url);
  const auth = btoa(`${email}:${token}`);
  const res = await safeOutboundFetch(
    url,
    {
      method: "POST",
      headers: injectW3cTraceHeaders(
        {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        { traceId: env?.ticketTraceId, spanId: projectKey },
      ),
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          summary: title,
          issuetype: { name: "Task" },
          description: {
            type: "doc",
            version: 1,
            content: [{ type: "paragraph", content: [{ type: "text", text: body || title }] }],
          },
        },
      }),
    },
    env,
  );
  if (!res.ok) return { ok: false, error: `jira_http_${res.status}`, status: 502 };
  const data = await res.json();
  const key = data?.key;
  const browse = key ? `${parsed.base}/browse/${key}` : null;
  if (!browse) return { ok: false, error: "jira_create_failed", status: 502 };
  logInfo("room_ticket.jira", { key });
  return { ok: true, ticket: { provider: "jira", url: browse, id: key } };
}
