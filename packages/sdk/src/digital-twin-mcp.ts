import type { DigitalTwinRoom } from "./digital-twin";
import type { McpToolDefinition, McpToolResult } from "./mcp-integration";

export interface DigitalTwinMcpRegistry {
  listTools(): McpToolDefinition[];
  callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult>;
  listResources(): Array<{ uri: string; name: string; description?: string }>;
  readResource(uri: string): { uri: string; text: string; mimeType: string } | null;
}

export function createDigitalTwinMcpRegistry(twin: DigitalTwinRoom): DigitalTwinMcpRegistry {
  const tools: McpToolDefinition[] = [
    {
      name: "twin.create_scene",
      description: "Create a spatial digital twin scene",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
    {
      name: "twin.add_entity",
      description: "Add an entity to a scene",
      inputSchema: {
        type: "object",
        properties: {
          sceneId: { type: "string" },
          type: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          z: { type: "number" },
        },
        required: ["sceneId", "type", "x", "y", "z"],
      },
    },
    {
      name: "twin.grant_agent",
      description: "Grant an agent access to a scene",
      inputSchema: {
        type: "object",
        properties: {
          sceneId: { type: "string" },
          agentId: { type: "string" },
          grants: { type: "array", items: { type: "string" } },
        },
        required: ["sceneId", "agentId", "grants"],
      },
    },
  ];

  return {
    listTools: () => tools,
    async callTool(name, args) {
      try {
        if (name === "twin.create_scene") {
          const scene = twin.createScene(String(args.name ?? "Scene"));
          return { content: [{ type: "text", text: JSON.stringify(scene) }] };
        }
        if (name === "twin.add_entity") {
          const entity = twin.addEntity(String(args.sceneId), {
            type: String(args.type ?? "object"),
            position: {
              x: Number(args.x ?? 0),
              y: Number(args.y ?? 0),
              z: Number(args.z ?? 0),
            },
            properties: {},
          });
          return { content: [{ type: "text", text: JSON.stringify(entity) }] };
        }
        if (name === "twin.grant_agent") {
          twin.grantAgentAccess(String(args.sceneId), {
            agentId: String(args.agentId),
            grants: (Array.isArray(args.grants) ? args.grants : ["view"]) as Array<
              "view" | "interact" | "modify" | "admin"
            >,
          });
          return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
        }
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
      } catch (err) {
        return {
          content: [{ type: "text", text: err instanceof Error ? err.message : "tool_failed" }],
          isError: true,
        };
      }
    },
    listResources() {
      return twin.listScenes().map((scene) => ({
        uri: `twin://scene/${scene.id}`,
        name: scene.name,
        description: `${scene.entities.length} entities`,
      }));
    },
    readResource(uri) {
      const match = /^twin:\/\/scene\/(.+)$/.exec(uri);
      if (!match) return null;
      const scene = twin.getScene(match[1]);
      if (!scene) return null;
      return { uri, text: JSON.stringify(scene), mimeType: "application/json" };
    },
  };
}
