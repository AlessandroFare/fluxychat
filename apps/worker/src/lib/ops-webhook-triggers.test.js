import { describe, expect, it } from "vitest";
import { createMemoryOpsStore } from "./ops-store.js";
import { defaultOpsPolicy } from "./ops-policy.js";
import {
  matchTriggerPattern,
  matchingWebhookWorkflows,
  startWebhookTriggeredRuns,
} from "./ops-webhook-triggers.js";

const endOnly = { slug: "", steps: [{ id: "end", type: "end" }] };

async function publish(store, slug, trigger, steps) {
  const definition = await store.createDefinition({ projectId: "p1", slug, createdBy: "u1" });
  return store.saveVersion({
    projectId: "p1",
    definitionId: definition.id,
    version: await store.nextVersionNumber("p1", definition.id),
    status: "published",
    definition: { ...endOnly, slug, ...(steps ? { steps } : {}), ...(trigger ? { trigger } : {}) },
    createdBy: "u1",
    publishedBy: "admin",
  });
}

describe("matchTriggerPattern", () => {
  it("matches exact keys and wildcard segments", () => {
    expect(matchTriggerPattern("sentry:issue:created", "sentry:issue:created")).toBe(true);
    expect(matchTriggerPattern("sentry:issue:*", "sentry:issue:created")).toBe(true);
    expect(matchTriggerPattern("*:*:*", "pagerduty:incident:incident.triggered")).toBe(true);
    expect(matchTriggerPattern("SENTRY:Issue:*", "sentry:issue:created")).toBe(true);
  });

  it("rejects other providers, kinds and segment counts", () => {
    expect(matchTriggerPattern("sentry:issue:created", "sentry:issue:resolved")).toBe(false);
    expect(matchTriggerPattern("sentry:issue:created", "github:issue:created")).toBe(false);
    expect(matchTriggerPattern("sentry:issue", "sentry:issue:created")).toBe(false);
    expect(matchTriggerPattern("", "sentry:issue:created")).toBe(false);
    expect(matchTriggerPattern("sentry:issue:created", "")).toBe(false);
  });
});

describe("matchingWebhookWorkflows", () => {
  const version = (slug, trigger) => ({ slug, definition: { trigger } });

  it("keeps only webhook triggers that match, including match lists", () => {
    const matched = matchingWebhookWorkflows(
      [
        version("a", { type: "webhook", match: "sentry:issue:*" }),
        version("b", { type: "webhook", match: ["github:pull_request:opened", "sentry:issue:created"] }),
        version("c", { type: "webhook", match: "github:pull_request:opened" }),
        version("d", { type: "manual", match: "sentry:issue:created" }),
        version("e", { type: "webhook", source: "incident" }),
        version("f", null),
      ],
      "sentry:issue:created",
    );
    expect(matched.map((row) => row.slug)).toEqual(["a", "b"]);
  });
});

describe("startWebhookTriggeredRuns", () => {
  it("starts a matched published workflow in the linked room", async () => {
    const store = createMemoryOpsStore();
    await store.putPolicy("p1", defaultOpsPolicy(), "admin");
    await publish(store, "sentry-triage", { type: "webhook", match: "sentry:issue:*" });

    const result = await startWebhookTriggeredRuns(
      {},
      {
        projectId: "p1",
        provider: "sentry",
        triggerKey: "sentry:issue:created",
        roomId: "r1",
        mapped: { title: "TypeError in checkout", body: "boom" },
        store,
      },
    );

    expect(result.started).toHaveLength(1);
    expect(result.started[0].slug).toBe("sentry-triage");
    const run = await store.getRun("p1", result.started[0].runId);
    expect(run.roomId).toBe("r1");
    expect(run.trigger).toMatchObject({
      type: "webhook",
      source: "integration",
      provider: "sentry",
      triggerKey: "sentry:issue:created",
    });
    expect(run.context.event.title).toBe("TypeError in checkout");
    expect(run.context.untrustedText).toBe("boom");
  });

  it("needs a linked room and a matching workflow", async () => {
    const store = createMemoryOpsStore();
    await publish(store, "sentry-triage", { type: "webhook", match: "sentry:issue:*" });
    const noRoom = await startWebhookTriggeredRuns(
      {},
      { projectId: "p1", provider: "sentry", triggerKey: "sentry:issue:created", roomId: null, store },
    );
    expect(noRoom).toMatchObject({ skipped: "no_room" });

    const noMatch = await startWebhookTriggeredRuns(
      {},
      { projectId: "p1", provider: "github", triggerKey: "github:issue:opened", roomId: "r1", store },
    );
    expect(noMatch).toMatchObject({ skipped: "no_match" });
  });

  it("ignores older published versions", async () => {
    const store = createMemoryOpsStore();
    await publish(store, "triage", { type: "webhook", match: "sentry:issue:*" });
    await publish(store, "triage", { type: "webhook", match: "github:issue:*" });
    const result = await startWebhookTriggeredRuns(
      {},
      { projectId: "p1", provider: "sentry", triggerKey: "sentry:issue:created", roomId: "r1", store },
    );
    expect(result).toMatchObject({ skipped: "no_match" });
  });

  it("caps fanout at three runs per event", async () => {
    const store = createMemoryOpsStore();
    for (const slug of ["a", "b", "c", "d"]) {
      await publish(store, slug, { type: "webhook", match: "*:*:*" });
    }
    const result = await startWebhookTriggeredRuns(
      {},
      { projectId: "p1", provider: "sentry", triggerKey: "sentry:issue:created", roomId: "r1", store },
    );
    expect(result.started).toHaveLength(3);
  });

  it("keeps starting the others when one workflow is broken", async () => {
    const store = createMemoryOpsStore();
    await publish(store, "broken", { type: "webhook", match: "sentry:issue:*" }, []);
    await publish(store, "fine", { type: "webhook", match: "sentry:issue:*" });
    const result = await startWebhookTriggeredRuns(
      {},
      { projectId: "p1", provider: "sentry", triggerKey: "sentry:issue:created", roomId: "r1", store },
    );
    expect(result.started.map((row) => row.slug)).toEqual(["fine"]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].slug).toBe("broken");
  });
});
