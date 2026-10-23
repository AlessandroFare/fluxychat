import { describe, expect, it } from "vitest";
import { get } from "svelte/store";
import { useChat } from "./index";

describe("@fluxy-chat/svelte README exports", () => {
  it("exposes the documented useChat store factory", () => {
    expect(typeof useChat).toBe("function");
  });

  it("returns a readable store with the documented actions", () => {
    const chat = useChat({ roomId: "smoke-room" });
    expect(typeof chat.subscribe).toBe("function");
    expect(typeof chat.sendMessage).toBe("function");
    expect(typeof chat.loadHistory).toBe("function");
    expect(typeof chat.loadMore).toBe("function");
    expect(Array.isArray(get(chat).messages)).toBe(true);
  });
});
