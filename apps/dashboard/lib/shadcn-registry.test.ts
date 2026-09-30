import { describe, expect, it } from "vitest";
import { getShadcnRegistryIndex, getShadcnRegistryItem } from "./shadcn-registry";

describe("shadcn-registry", () => {
  it("lists widget and window items", () => {
    const index = getShadcnRegistryIndex();
    expect(index.name).toBe("fluxychat");
    expect(index.items.map((i) => i.name)).toEqual(["fluxy-chat-widget", "fluxy-chat-window"]);
  });

  it("embeds a wrapper that imports ui-kit, not a full component dump", () => {
    const item = getShadcnRegistryItem("fluxy-chat-widget.json");
    expect(item?.files[0]?.content).toContain("@fluxy-chat/ui-kit");
    expect(item?.files[0]?.content.length ?? 0).toBeLessThan(2000);
  });
});
