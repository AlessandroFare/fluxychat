import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  ackConsole,
  isWorkerGet,
  seedAdminSession,
  skipWithoutAdminJwt,
  workerOrigin,
} from "./helpers";

/**
 * Agents against a live Worker.
 *
 *   pnpm test:e2e:integrated -- agents.integrated
 */
function authHeaders(jwt: string) {
  return { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" };
}

function jwtSub(token: string): string {
  const part = token.split(".")[1];
  if (!part) return "";
  try {
    const claims = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as { sub?: string };
    return String(claims.sub ?? "");
  } catch {
    return "";
  }
}

/** One key from apps/worker/.dev.vars (Playwright runs from apps/dashboard). */
function devVarsValue(key: string): string {
  try {
    const raw = readFileSync(join(process.cwd(), "..", "worker", ".dev.vars"), "utf8");
    const match = raw.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, "m"));
    return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
  } catch {
    return "";
  }
}

test.describe("agents integrated", () => {
  test("lists agents after seeding an admin session", async ({ page, context }) => {
    const adminJwt = skipWithoutAdminJwt();
    await ackConsole(context);
    await seedAdminSession(page, adminJwt);

    const list = page.waitForResponse(
      (res) => isWorkerGet(res.url(), "/agents") && res.request().method() === "GET",
      { timeout: 45_000 },
    );
    await page.goto("/agents", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Agents", exact: true, level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    const res = await list;
    expect(res.status()).toBe(200);
    await expect(page.getByLabel("Agents sidebar")).toBeVisible();
  });

  test("invokes an agent into a room from the dashboard", async ({ page, context }) => {
    const adminJwt = skipWithoutAdminJwt();
    await ackConsole(context);
    await seedAdminSession(page, adminJwt);

    // The invoke needs a live LLM behind the Worker env. Probe with the same
    // defaults an agent run uses (/api/devtools/chat) and skip — with the exact
    // upstream reason — when this dev gateway cannot serve a model.
    const model = devVarsValue("AI_MODEL");
    const probe = await page.request.post(`${workerOrigin}/api/devtools/chat`, {
      headers: authHeaders(adminJwt),
      data: { message: "ping", stream: false },
    });
    if (probe.status() !== 200) {
      const error =
        ((await probe.json().catch(() => ({}))) as { error?: string }).error ??
        `devtools chat status ${probe.status()}`;
      expect(probe.status(), `devtools probe rejected the admin JWT: ${error}`).not.toBe(401);
      test.skip(true, `No live LLM in this Worker env: ${error}`);
    }
    test.skip(!model, "No AI_MODEL in apps/worker/.dev.vars — cannot pin the fixture agent");

    // Fixtures: the room picker needs a room; the idempotent agent (stable id)
    // is pinned to the dev gateway's model (builtin agents may point elsewhere).
    const roomsRes = await page.request.get(`${workerOrigin}/rooms`, { headers: authHeaders(adminJwt) });
    expect(roomsRes.ok()).toBeTruthy();
    const rooms = ((await roomsRes.json()) as { rooms?: unknown[] }).rooms ?? [];
    if (rooms.length === 0) {
      const createdRoom = await page.request.post(`${workerOrigin}/rooms`, {
        headers: authHeaders(adminJwt),
        data: { name: `E2E invoke ${Date.now()}`, type: "group" },
      });
      expect(createdRoom.ok()).toBeTruthy();
    }

    const agentId = "e2e-invoke-agent";
    const upsertAgent = await page.request.post(`${workerOrigin}/agents`, {
      headers: authHeaders(adminJwt),
      data: {
        id: agentId,
        name: "E2E invoke agent",
        handle: "e2e_invoke",
        provider: "custom",
        model,
      },
    });
    expect(upsertAgent.ok()).toBeTruthy();

    await page.goto(`/agents/${agentId}/invoke`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Test invoke", { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByPlaceholder("Hello from the dashboard…").fill("E2E ping: answer with one word.");

    const invokeButton = page.getByRole("button", { name: "Invoke", exact: true });
    await expect(invokeButton).toBeEnabled({ timeout: 30_000 }); // room picker auto-selects

    const invoked = page.waitForResponse(
      (res) => res.url().includes(`/agents/${agentId}/invoke`) && res.request().method() === "POST",
      { timeout: 90_000 },
    );
    await invokeButton.click();
    expect((await invoked).status()).toBe(200);
    await expect(page.getByText("Invoke completed. Check run history below.")).toBeVisible({
      timeout: 60_000,
    });
  });

  test("approves a HITL request from the inbox and refuses a second decision", async ({ page, context }) => {
    const adminJwt = skipWithoutAdminJwt();
    await ackConsole(context);
    await seedAdminSession(page, adminJwt);

    const sub = jwtSub(adminJwt);
    expect(sub).toBeTruthy();

    const required = await page.request.post(`${workerOrigin}/approvals/require`, {
      headers: authHeaders(adminJwt),
      data: { toolName: "e2e_refund_approval", toolInput: { amount: 42 }, approverIds: [sub] },
    });
    expect(required.ok()).toBeTruthy();
    const { approvalId } = (await required.json()) as { approvalId?: string };
    if (!approvalId) throw new Error("approvals/require returned no approvalId");

    // Deterministic inbox: reject stragglers from earlier runs via API so the
    // panel decides this request on the first click (no confirm re-press).
    const pendingRes = await page.request.get(`${workerOrigin}/api/hitl/approvals?approverId=me`, {
      headers: authHeaders(adminJwt),
    });
    expect(pendingRes.ok()).toBeTruthy();
    const pending = ((await pendingRes.json()) as { approvals?: Array<{ id?: string }> }).approvals ?? [];
    for (const other of pending) {
      if (!other.id || other.id === approvalId) continue;
      await page.request.post(`${workerOrigin}/approvals/${other.id}/decision`, {
        headers: authHeaders(adminJwt),
        data: { decision: "reject", note: "e2e cleanup" },
      });
    }

    await page.goto("/inbox", { waitUntil: "domcontentloaded" });
    const item = page.locator("li").filter({ hasText: approvalId });
    await expect(item).toBeVisible({ timeout: 30_000 });
    await item.getByRole("button", { name: "Approve" }).click();
    await expect(item).toHaveCount(0, { timeout: 30_000 });

    // First decision wins: the same request refuses a second decision.
    const second = await page.request.post(
      `${workerOrigin}/approvals/${encodeURIComponent(approvalId)}/decision`,
      { headers: authHeaders(adminJwt), data: { decision: "reject" } },
    );
    expect(second.status()).toBe(409);
    expect(((await second.json()) as { error?: string }).error).toMatch(/already/);
  });
});
