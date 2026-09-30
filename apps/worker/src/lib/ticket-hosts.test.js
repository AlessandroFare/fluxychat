import { describe, expect, it } from "vitest";
import { assertTicketFetchUrl, parseJiraBaseUrl } from "./ticket-hosts.js";

describe("ticket-hosts", () => {
  it("allows GitHub and Linear API hosts only", () => {
    expect(() => assertTicketFetchUrl("github", "https://api.github.com/repos/a/b/issues")).not.toThrow();
    expect(() => assertTicketFetchUrl("linear", "https://api.linear.app/graphql")).not.toThrow();
    expect(() => assertTicketFetchUrl("github", "https://evil.example/repos/a/b/issues")).toThrow(
      /ticket_host_blocked/,
    );
  });

  it("requires Jira *.atlassian.net", () => {
    expect(parseJiraBaseUrl("https://acme.atlassian.net")).toMatchObject({
      ok: true,
      base: "https://acme.atlassian.net",
    });
    expect(parseJiraBaseUrl("https://evil.example")).toMatchObject({ error: "jira_host_not_atlassian" });
    expect(() => assertTicketFetchUrl("jira", "https://169.254.169.254/rest/api/3/issue")).toThrow();
  });
});
