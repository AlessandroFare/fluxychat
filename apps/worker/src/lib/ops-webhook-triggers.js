/**
 * Definition-declared webhook triggers: a published workflow whose
 * `trigger` is `{ type: "webhook", match: "<provider>:<entityType>:<kind>" }`
 * starts when a signature-verified integration event matches that key.
 * Key shape matches the ambient-agent triggerKey; `*` matches one segment.
 *
 * The incident lifecycle keeps its own knobs (policy.incidentWorkflowSlug for
 * "created", policy.incidentWorkflowSlugs for later phases), which are
 * provider-agnostic — do not also declare `match` on those workflows.
 */

/** Event storms must not fan out into an unbounded number of runs. */
const MAX_RUNS_PER_EVENT = 3;

export function matchTriggerPattern(pattern, triggerKey) {
  const wanted = String(pattern || "").trim().toLowerCase();
  const key = String(triggerKey || "").trim().toLowerCase();
  if (!wanted || !key) return false;
  const segments = wanted.split(":");
  const actual = key.split(":");
  if (segments.length !== actual.length) return false;
  return segments.every((segment, index) => segment === "*" || segment === actual[index]);
}

function matchList(trigger) {
  if (Array.isArray(trigger?.match)) return trigger.match.map(String).filter(Boolean);
  if (typeof trigger?.match === "string" && trigger.match.trim()) return [trigger.match.trim()];
  return [];
}

/** Latest published versions that declared interest in this event key. */
export function matchingWebhookWorkflows(definitions, triggerKey) {
  return (definitions || []).filter((version) => {
    const trigger = version?.definition?.trigger;
    if (!trigger || trigger.type !== "webhook") return false;
    return matchList(trigger).some((pattern) => matchTriggerPattern(pattern, triggerKey));
  });
}

export async function startWebhookTriggeredRuns(env, {
  projectId,
  triggerKey,
  provider,
  roomId,
  mapped,
  incidentId,
  store: injectedStore,
}) {
  if (!roomId) return { skipped: "no_room", started: [] };
  const store = injectedStore || (await import("./ops-store-d1.js")).createD1OpsStore(env);
  const published = await store.listLatestPublished(projectId);
  const matched = matchingWebhookWorkflows(published, triggerKey).slice(0, MAX_RUNS_PER_EVENT);
  if (!matched.length) return { skipped: "no_match", started: [] };
  const { normalizeOpsPolicy } = await import("./ops-policy.js");
  const { startOpsRun } = await import("./ops-engine.js");
  const { executeOpsTool } = await import("./ops-sources.js");
  const policy = normalizeOpsPolicy(await store.getPolicy(projectId));
  const title = String(mapped?.title || "Event").slice(0, 200);
  const started = [];
  const errors = [];
  for (const version of matched) {
    try {
      const run = await startOpsRun(store, {
        env,
        projectId,
        version,
        trigger: {
          type: "webhook",
          source: "integration",
          provider,
          triggerKey,
          incidentId: incidentId || null,
        },
        actor: `integration:${provider}`,
        roomId,
        context: {
          event: { provider, triggerKey, title, incidentId: incidentId || null },
          toolInputs: { "files.search": { query: title } },
          // Provider payload text is attacker-influenced: the engine records
          // injection attempts instead of obeying them.
          untrustedText: String(mapped?.body || "").slice(0, 2000),
        },
        executeTool: (name, input, extra) =>
          executeOpsTool(store, policy, env, name, input, { ...extra, projectId }),
      });
      started.push({ slug: version.slug, runId: run.id, status: run.status });
    } catch (err) {
      errors.push({ slug: version.slug, message: String(err?.message || err) });
    }
  }
  return { started, ...(errors.length ? { errors } : {}) };
}
