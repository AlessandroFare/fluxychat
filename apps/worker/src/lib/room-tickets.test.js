import { describe, expect, it } from "vitest";
import { createExternalTicket } from "./room-tickets.js";

describe("createExternalTicket", () => {
  it("rejects unknown provider and empty title", async () => {
    expect(await createExternalTicket({}, { provider: "slack", title: "x" })).toMatchObject({
      ok: false,
      error: "unknown_provider",
    });
    expect(await createExternalTicket({}, { provider: "github", title: "" })).toMatchObject({
      error: "title_required",
    });
  });

  it("requires GITHUB_TOKEN and a owner/repo", async () => {
    expect(await createExternalTicket({}, { provider: "github", title: "Bug", repo: "a/b" })).toMatchObject({
      error: "github_token_missing",
    });
    expect(
      await createExternalTicket({ GITHUB_TOKEN: "t" }, { provider: "github", title: "Bug", repo: "../nope" }),
    ).toMatchObject({ error: "invalid_repo" });
  });

  it("refuses Worker-env PATs on hosted multi-tenant", async () => {
    expect(
      await createExternalTicket(
        { HOSTED_MULTI_TENANT: "true", GITHUB_TOKEN: "shared" },
        { provider: "github", title: "Bug", repo: "a/b" },
      ),
    ).toMatchObject({ error: "hosted_project_token_required" });
  });
});
