import { describe, it, expect, vi } from "vitest";
import { dynamicTool, createDynamicToolRegistry, typeNarrowDynamicTool } from "./dynamic-tools";

describe("dynamic-tools", () => {
  describe("dynamicTool", () => {
    it("creates tool with type='dynamic'", () => {
      const t = dynamicTool({ name: "weather", description: "Get weather" });
      expect(t.type).toBe("dynamic");
      expect(t.name).toBe("weather");
    });

    it("preserves all config properties", () => {
      const execute = vi.fn();
      const t = dynamicTool({ name: "search", execute, inputSchema: { query: "string" } });
      expect(t.execute).toBe(execute);
      expect(t.inputSchema).toEqual({ query: "string" });
    });
  });

  describe("createDynamicToolRegistry", () => {
    it("starts empty", () => {
      const reg = createDynamicToolRegistry();
      expect(reg.list()).toEqual([]);
    });

    it("register and get a tool", () => {
      const reg = createDynamicToolRegistry();
      const t = dynamicTool({ name: "weather" });
      reg.register(t);
      expect(reg.get("weather")).toBe(t);
    });

    it("unregister removes tool", () => {
      const reg = createDynamicToolRegistry();
      reg.register(dynamicTool({ name: "weather" }));
      reg.unregister("weather");
      expect(reg.get("weather")).toBeUndefined();
    });

    it("call executes tool and returns result", async () => {
      const reg = createDynamicToolRegistry();
      const execute = vi.fn().mockReturnValue({ temperature: 72 });
      reg.register(dynamicTool({ name: "weather", execute }));
      const result = await reg.call("weather", { location: "NYC" });
      expect(result).toEqual({ temperature: 72 });
      expect(execute).toHaveBeenCalledWith({ location: "NYC" });
    });

    it("call throws for unknown tool", async () => {
      const reg = createDynamicToolRegistry();
      await expect(reg.call("unknown", {})).rejects.toThrow('Dynamic tool "unknown" not found');
    });

    it("call throws for tool without execute", async () => {
      const reg = createDynamicToolRegistry();
      reg.register(dynamicTool({ name: "noop" }));
      await expect(reg.call("noop", {})).rejects.toThrow('Dynamic tool "noop" has no execute function');
    });

    it("clear removes all tools", () => {
      const reg = createDynamicToolRegistry();
      reg.register(dynamicTool({ name: "a" }));
      reg.register(dynamicTool({ name: "b" }));
      reg.clear();
      expect(reg.list()).toEqual([]);
    });
  });

  describe("typeNarrowDynamicTool", () => {
    it("creates dynamic tool with typed execute", () => {
      interface WeatherInput { location: string }
      interface WeatherOutput { temperature: number }
      const t = typeNarrowDynamicTool<WeatherInput, WeatherOutput>({
        name: "weather",
        execute: (input) => ({ temperature: input.location === "NYC" ? 72 : 65 }),
      });
      expect(t.type).toBe("dynamic");
    });
  });
});
