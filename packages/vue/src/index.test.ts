import { describe, expect, it } from "vitest";
import { useChat } from "./index";

describe("@fluxy-chat/vue README exports", () => {
  it("exposes the documented useChat composable", () => {
    expect(typeof useChat).toBe("function");
  });

  it("returns the documented refs and actions without a client", () => {
    // Outside a component instance Vue only warns (lifecycle hooks no-op), but
    // the returned surface is still built from the room store.
    const chat = useChat({ roomId: "smoke-room" });
    expect(Array.isArray(chat.messages.value)).toBe(true);
    expect(typeof chat.sendMessage).toBe("function");
    expect(typeof chat.invokeAgent).toBe("function");
    expect(typeof chat.stopAgentStream).toBe("function");
    expect(typeof chat.loadHistory).toBe("function");
    expect(typeof chat.loadMore).toBe("function");
    expect(chat.store).toBeDefined();
  });
});
