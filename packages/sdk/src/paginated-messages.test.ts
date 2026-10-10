import { describe, expect, it } from "vitest";
import { fetchMessageHistoryPage } from "./paginated-messages";
import type { FetchMessagesOptions, FluxyChatMessage } from "./fluxy-chat-client";

function msg(id: number, createdAt: string): FluxyChatMessage {
  return {
    id,
    roomId: "lobby",
    userId: "u",
    content: String(id),
    createdAt,
  } as FluxyChatMessage;
}

describe("fetchMessageHistoryPage", () => {
  it("FX-HIST-1 newestFirst pages with beforeSerial on the oldest row", async () => {
    const calls: FetchMessagesOptions[] = [];
    const fetchPage = async (options: FetchMessagesOptions) => {
      calls.push(options);
      if (options.beforeSerial == null) {
        return [msg(1, "2026-01-01T00:00:00.000Z"), msg(2, "2026-01-02T00:00:00.000Z")];
      }
      return [msg(0, "2025-12-31T00:00:00.000Z")];
    };

    const page = await fetchMessageHistoryPage(fetchPage, { limit: 2 });
    expect(page.items.map((row) => row.id)).toEqual([2, 1]);
    expect(page.hasNext()).toBe(true);
    const next = await page.next();
    expect(next?.items.map((row) => row.id)).toEqual([0]);
    expect(next?.isLast()).toBe(true);
    expect(calls[1]?.beforeSerial).toBe(1);
  });
});
