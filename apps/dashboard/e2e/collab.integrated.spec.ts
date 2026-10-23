import { expect, test } from "@playwright/test";
import { ackConsole, seedAdminSession, skipWithoutAdminJwt, workerOrigin } from "./helpers";

/**
 * Collab comments against a live Worker (real D1, no fixtures baked into the UI).
 *
 *   pnpm test:e2e:integrated -- collab.integrated
 */
function authHeaders(jwt: string) {
  return { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" };
}

test.describe("collab integrated", () => {
  test("posts a comment thread from the workspace tab and deletes it", async ({ page, context }) => {
    const adminJwt = skipWithoutAdminJwt();
    await ackConsole(context);
    await seedAdminSession(page, adminJwt);

    const roomsRes = await page.request.get(`${workerOrigin}/rooms`, { headers: authHeaders(adminJwt) });
    expect(roomsRes.ok()).toBeTruthy();
    const rooms = ((await roomsRes.json()) as { rooms?: Array<{ id: string }> }).rooms ?? [];
    let roomId = rooms[0]?.id;
    if (!roomId) {
      const createdRoom = await page.request.post(`${workerOrigin}/rooms`, {
        headers: authHeaders(adminJwt),
        data: { name: `E2E collab ${Date.now()}`, type: "group" },
      });
      expect(createdRoom.ok()).toBeTruthy();
      const created = (await createdRoom.json()) as { room?: { id?: string }; id?: string };
      roomId = created.room?.id ?? created.id;
    }
    expect(roomId).toBeTruthy();

    await page.goto(`/collab/${roomId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Comments" })).toBeVisible({ timeout: 30_000 });

    const listed = page.waitForResponse(
      (res) =>
        res.request().method() === "GET" &&
        new URL(res.url()).pathname.endsWith("/comment-threads"),
      { timeout: 45_000 },
    );
    await page.getByRole("button", { name: "Comments" }).click();
    expect((await listed).status()).toBe(200);

    const body = `E2E thread ${Date.now()}`;
    await page.getByPlaceholder("Start a thread...").fill(body);
    const posted = page.waitForResponse(
      (res) => res.url().includes("/comment-threads") && res.request().method() === "POST",
      { timeout: 45_000 },
    );
    await page.getByRole("button", { name: "Post" }).click();
    const postedRes = await posted;
    expect(postedRes.status()).toBe(201);
    const threadId = ((await postedRes.json()) as { thread?: { id?: string } }).thread?.id ?? "";
    expect(threadId).toBeTruthy();

    await expect(page.getByText(body)).toBeVisible({ timeout: 15_000 });

    const cleanup = await page.request.delete(
      `${workerOrigin}/rooms/${roomId}/comment-threads/${threadId}`,
      { headers: authHeaders(adminJwt) },
    );
    expect(cleanup.ok()).toBeTruthy();
  });
});
