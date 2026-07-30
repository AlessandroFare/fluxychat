import { describe, expect, it } from "vitest";
import { createDigitalTwinRoom } from "./digital-twin";
import { createDigitalTwinMcpRegistry } from "./digital-twin-mcp";

describe("createDigitalTwinMcpRegistry", () => {
  it("exposes MCP tools for twin operations", async () => {
    const twin = createDigitalTwinRoom();
    const mcp = createDigitalTwinMcpRegistry(twin);

    expect(mcp.listTools().map((t) => t.name)).toContain("twin.create_scene");

    const created = await mcp.callTool("twin.create_scene", { name: "Ops floor" });
    const scene = JSON.parse(String(created.content[0]?.text)) as { id: string };

    const entity = await mcp.callTool("twin.add_entity", {
      sceneId: scene.id,
      type: "sensor",
      x: 1,
      y: 2,
      z: 0,
    });
    expect(entity.isError).not.toBe(true);

    const resources = mcp.listResources();
    expect(resources.some((r) => r.uri === `twin://scene/${scene.id}`)).toBe(true);

    const resource = mcp.readResource(`twin://scene/${scene.id}`);
    expect(resource?.mimeType).toBe("application/json");
  });
});
