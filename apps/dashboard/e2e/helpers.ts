import { expect, type Page } from "@playwright/test";

/** Poll until the message list shows text (WebSocket delivery can lag). */
export async function expectMessageListContains(
  page: Page,
  text: string,
  options?: { timeoutMs?: number },
) {
  const timeout = options?.timeoutMs ?? 45_000;
  const list = page.getByTestId("message-list");
  await expect
    .poll(
      async () => {
        const content = await list.textContent();
        return content?.includes(text) ?? false;
      },
      { timeout, intervals: [250, 500, 1000, 2000] },
    )
    .toBe(true);
}

/** Click send-sample and wait for a echoed message (retries one extra send on slow WS). */
export async function sendSampleAndWaitForEcho(page: Page, userId = "alice") {
  const sendBtn = page.getByTestId("send-sample-btn");
  await expect(sendBtn).toBeEnabled({ timeout: 30_000 });

  const needle = `Hello from ${userId}`;
  await sendBtn.click();
  try {
    await expectMessageListContains(page, needle, { timeoutMs: 25_000 });
    return;
  } catch {
    await sendBtn.click();
    await expectMessageListContains(page, needle, { timeoutMs: 25_000 });
  }
}
