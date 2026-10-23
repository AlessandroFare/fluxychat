import { describe, expect, it } from "vitest";
import {
  exportOpsAudit,
  exportOpsEvidence,
  opsAuditJsonl,
  opsEvidenceJsonl,
  buildOpsRunReceipt,
  buildOpsEvidenceReceipt,
} from "./ops-audit.js";
import { verifyAuditExport } from "./ops-receipts.js";
import { AUDIT_CHAIN_GENESIS_HASH, sha256Hex } from "./audit-chain.js";
import { createMemoryOpsStore } from "./ops-store.js";
import { startOpsRun, decideRunApproval } from "./ops-engine.js";
import { decideOpsApproval } from "./ops-gateway.js";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

async function seedApprovalRun(store, projectId = "p1") {
  const def = await store.createDefinition({ projectId, slug: "deploy", createdBy: "u1" });
  const version = await store.saveVersion({
    projectId,
    definitionId: def.id,
    version: 1,
    status: "published",
    createdBy: "u1",
    publishedBy: "admin",
    definition: {
      slug: "deploy",
      steps: [
        { id: "approve", type: "approval", roles: ["owner"], quorum: { default: 1 }, timeout: { after: "1h" }, next: "end" },
        { id: "end", type: "end" },
      ],
    },
  });
  return startOpsRun(store, { projectId, version, actor: "u1", roomId: "room-1", executeTool: async () => ({ ok: true }) });
}

describe("ops-audit", () => {
  it("exports the project evidence for a period without leaking run context", async () => {
    const store = createMemoryOpsStore();
    const run = await seedApprovalRun(store);
    const approval = await store.getApproval("p1", run.context.approvalId);
    await decideOpsApproval(store, {
      projectId: "p1",
      approvalId: approval.id,
      actor: "u2",
      decision: "approve",
      payloadHash: approval.payloadHash,
    });

    const all = await exportOpsEvidence(store, { projectId: "p1" });
    expect(all.ok).toBe(true);
    expect(all.json.runs).toHaveLength(1);
    expect(all.json.runs[0]).toMatchObject({ id: run.id, status: "waiting", trigger: "manual" });
    expect(all.json.runs[0].context).toBeUndefined();
    expect(all.json.events.length).toBeGreaterThan(0);
    expect(all.json.events[0].runId).toBe(run.id);
    expect(all.json.approvals[0].runId).toBe(run.id);
    expect(all.json.approvals[0].decisions[0].actor).toBe("u2");
    // The oversight numbers travel with the evidence pack.
    expect(all.json.oversight).toMatchObject({ decided: 1, approved: 1, denied: 0, quorumRequested: 0 });
    expect(JSON.stringify(all.json)).not.toContain("\"payload\":");

    const future = await exportOpsEvidence(store, { projectId: "p1", from: "2999-01-01T00:00:00.000Z" });
    expect(future.json.events).toHaveLength(0);
    expect(future.json.runs).toHaveLength(0);
    expect(future.json.approvals).toHaveLength(0);

    const lines = opsEvidenceJsonl(all.json).trim().split("\n").map((line) => JSON.parse(line));
    expect(lines[0]).toMatchObject({ record: "header", projectId: "p1" });
    expect(lines[0].oversight.decided).toBe(1);
    expect(lines.map((line) => line.record)).toContain("event");
    expect(lines.map((line) => line.record)).toContain("approval");
  });

  it("includes the human decisions but never the frozen payload", async () => {
    const store = createMemoryOpsStore();
    const run = await seedApprovalRun(store);
    const approval = await store.getApproval("p1", run.context.approvalId);
    await decideOpsApproval(store, {
      projectId: "p1",
      approvalId: approval.id,
      actor: "u2",
      decision: "approve",
      payloadHash: approval.payloadHash,
    });

    const exported = await exportOpsAudit(store, { projectId: "p1", runId: run.id });
    expect(exported.ok).toBe(true);
    expect(exported.json.approvals).toHaveLength(1);
    const [evidence] = exported.json.approvals;
    expect(evidence.payloadHash).toBe(approval.payloadHash);
    expect(evidence.required).toBe(1);
    expect(evidence.status).toBe("approved");
    expect(evidence.decisions).toEqual([{ actor: "u2", decision: "approve", at: expect.any(String) }]);
    expect(JSON.stringify(exported.json)).not.toContain("payload\":");
  });

  it("renders JSONL with one record per line", async () => {
    const store = createMemoryOpsStore();
    const run = await seedApprovalRun(store);
    const approval = await store.getApproval("p1", run.context.approvalId);
    await decideOpsApproval(store, {
      projectId: "p1",
      approvalId: approval.id,
      actor: "u2",
      decision: "approve",
      payloadHash: approval.payloadHash,
    });

    const exported = await exportOpsAudit(store, { projectId: "p1", runId: run.id });
    const lines = opsAuditJsonl(exported.json).trim().split("\n").map((line) => JSON.parse(line));
    const kinds = lines.map((line) => line.record);
    expect(kinds[0]).toBe("run");
    expect(kinds).toContain("step");
    expect(kinds).toContain("event");
    expect(kinds).toContain("approval");
    expect(lines[0].runId).toBe(run.id);
    expect(lines[0].steps).toBeUndefined();
    expect(lines.find((line) => line.record === "approval").decisions[0].actor).toBe("u2");
  });

  it("seals a run receipt that verifies offline and detects tampering (I4)", async () => {
    const store = createMemoryOpsStore();
    const run = await seedApprovalRun(store);
    const approval = await store.getApproval("p1", run.context.approvalId);
    await decideOpsApproval(store, {
      projectId: "p1",
      approvalId: approval.id,
      actor: "u2",
      decision: "approve",
      payloadHash: approval.payloadHash,
    });

    const sealed = await buildOpsRunReceipt(store, { projectId: "p1", runId: run.id });
    expect(sealed.ok).toBe(true);
    const receipt = sealed.receipt;
    expect(receipt.format).toBe("fluxy-audit-receipt.v1");
    expect(receipt.records.map((record) => record.kind)).toContain("approval");
    expect(receipt.counts.approvals).toBe(1);
    // Same guarantee as the evidence pack: the frozen payload stays out.
    expect(JSON.stringify(receipt)).not.toContain("\"payload\":");

    const verified = await verifyAuditExport(receipt);
    expect(verified).toMatchObject({ kind: "ops_receipt", valid: true, count: receipt.records.length, tipHash: receipt.tipHash });

    // Flip one human decision in the exported file: the chain must break there.
    const tampered = JSON.parse(JSON.stringify(receipt));
    const approvalRecord = tampered.records.find((record) => record.kind === "approval");
    approvalRecord.value.decisions[0].decision = "deny";
    const broken = await verifyAuditExport(tampered);
    expect(broken.valid).toBe(false);
    expect(broken.firstBreakSeq).toBe(approvalRecord.seq);

    // A missing record also breaks the chain (deletion, not just edit).
    const shortened = JSON.parse(JSON.stringify(receipt));
    shortened.records.splice(1, 1);
    expect((await verifyAuditExport(shortened)).valid).toBe(false);
  });

  it("verifies a sealed export with the offline CLI: exit 0 valid, 1 tampered, 2 no args (I4)", async () => {
    const store = createMemoryOpsStore();
    const run = await seedApprovalRun(store);
    const sealed = await buildOpsRunReceipt(store, { projectId: "p1", runId: run.id });
    expect(sealed.ok).toBe(true);

    const dir = await mkdtemp(join(tmpdir(), "fluxy-verify-"));
    const cli = fileURLToPath(new URL("../../../../scripts/verify-audit-export.mjs", import.meta.url));
    const validPath = join(dir, "valid.json");
    await writeFile(validPath, JSON.stringify(sealed.receipt), "utf8");

    const valid = spawnSync(process.execPath, [cli, validPath], { encoding: "utf8" });
    expect(valid.status).toBe(0);
    expect(valid.stdout).toContain("fluxy verify: OK");

    const tampered = JSON.parse(JSON.stringify(sealed.receipt));
    tampered.records[0].value = { ...tampered.records[0].value, tampered: "yes" };
    const brokenPath = join(dir, "broken.json");
    await writeFile(brokenPath, JSON.stringify(tampered), "utf8");
    const broken = spawnSync(process.execPath, [cli, brokenPath], { encoding: "utf8" });
    expect(broken.status).toBe(1);
    expect(broken.stderr).toContain("fluxy verify: FAIL");

    const usage = spawnSync(process.execPath, [cli], { encoding: "utf8" });
    expect(usage.status).toBe(2);

    await rm(dir, { recursive: true, force: true });
  });

  it("seals a period evidence receipt over runs, events and approvals (I4)", async () => {
    const store = createMemoryOpsStore();
    const run = await seedApprovalRun(store);
    await decideOpsApproval(store, {
      projectId: "p1",
      approvalId: run.context.approvalId,
      actor: "u2",
      decision: "approve",
      payloadHash: run.context.payloadHash,
    });

    const sealed = await buildOpsEvidenceReceipt(store, { projectId: "p1" });
    expect(sealed.ok).toBe(true);
    expect(sealed.receipt.counts).toMatchObject({ runs: 1, approvals: 1 });
    expect(sealed.receipt.counts.events).toBeGreaterThan(0);
    const verified = await verifyAuditExport(sealed.receipt);
    expect(verified).toMatchObject({ kind: "ops_receipt", valid: true, tipHash: sealed.receipt.tipHash });
  });

  it("verifies a room audit-chain export offline, and only that file (I4)", async () => {
    const events = [
      { actor: "u1", type: "message", roomId: "room-1" },
      { actor: "u2", type: "member_joined", roomId: "room-1" },
    ];
    let prev = AUDIT_CHAIN_GENESIS_HASH;
    const entries = [];
    for (const event of events) {
      const createdAt = new Date().toISOString();
      const eventJson = JSON.stringify({ ...event, createdAt });
      const eventHash = await sha256Hex(`${prev}:${eventJson}`);
      entries.push({ id: entries.length + 1, prevHash: prev, eventHash, event: JSON.parse(eventJson), createdAt });
      prev = eventHash;
    }
    const exported = { ok: true, projectId: "p1", entries };
    const verified = await verifyAuditExport(exported);
    expect(verified).toMatchObject({ kind: "room_chain", valid: true, count: 2, tipHash: prev });

    exported.entries[1].event.type = "edited";
    const broken = await verifyAuditExport(exported);
    expect(broken.valid).toBe(false);
    expect(broken.firstBreakSeq).toBe(1);
  });
});
