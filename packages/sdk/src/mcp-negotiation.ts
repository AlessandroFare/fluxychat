export type McpProtocolVersion = "v1" | "v2" | "v3";
export type McpTransportType = "streamable-http" | "sse" | "stdio" | "websocket";

export interface McpProtocolCapability {
  transport: McpTransportType;
  version: McpProtocolVersion;
  features: string[];
}

export interface McpNegotiationResult {
  agreedVersion: McpProtocolVersion;
  agreedTransport: McpTransportType;
  serverCapabilities: McpProtocolCapability[];
  clientCapabilities: McpProtocolCapability[];
}

export interface McpProtocolNegotiationApi {
  propose(capabilities: McpProtocolCapability[]): McpNegotiationResult;
  getSupportedVersions(): McpProtocolVersion[];
  getSupportedTransports(): McpTransportType[];
}

const VERSION_PRIORITY: McpProtocolVersion[] = ["v3", "v2", "v1"];
const TRANSPORT_PRIORITY: McpTransportType[] = ["streamable-http", "sse", "websocket", "stdio"];

export function createMcpNegotiation(serverCaps?: McpProtocolCapability[]): McpProtocolNegotiationApi {
  const serverCapabilities = serverCaps ?? [
    { transport: "streamable-http", version: "v3", features: ["tools", "resources", "prompts"] },
    { transport: "sse", version: "v2", features: ["tools", "resources"] },
    { transport: "stdio", version: "v1", features: ["tools"] },
  ];

  return {
    getSupportedVersions() { return [...VERSION_PRIORITY]; },
    getSupportedTransports() { return [...TRANSPORT_PRIORITY]; },

    propose(clientCapabilities) {
      let agreedVersion: McpProtocolVersion = "v1";
      let agreedTransport: McpTransportType = "stdio";

      for (const v of VERSION_PRIORITY) {
        if (clientCapabilities.some((c) => c.version === v) && serverCapabilities.some((c) => c.version === v)) { agreedVersion = v; break; }
      }

      for (const t of TRANSPORT_PRIORITY) {
        if (clientCapabilities.some((c) => c.transport === t && c.version === agreedVersion) && serverCapabilities.some((c) => c.transport === t && c.version === agreedVersion)) { agreedTransport = t; break; }
      }

      return { agreedVersion, agreedTransport, serverCapabilities, clientCapabilities };
    },
  };
}
