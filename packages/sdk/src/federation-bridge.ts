export type FederationProtocol = "matrix" | "activitypub" | "dm" | "custom";

export interface BridgeConfig {
  protocol: FederationProtocol;
  remoteUrl: string;
  apiKey?: string;
  webhookSecret?: string;
  syncIntervalMs: number;
  complianceMode: "dma" | "gdpr" | "none";
}

export interface RemoteIdentity {
  remoteId: string;
  localId: string;
  displayName: string;
  protocol: FederationProtocol;
  linkedAt: string;
}

export interface BridgedMessage {
  bridgeId: string;
  protocol: FederationProtocol;
  remoteMessageId: string;
  localMessageId: string;
  roomId: string;
  senderId: string;
  content: string;
  timestamp: string;
  direction: "inbound" | "outbound";
}

export interface BridgeStatus {
  protocol: FederationProtocol;
  connected: boolean;
  lastSyncAt: string | null;
  messageCount: number;
  errorCount: number;
}

export interface FederationBridge {
  addBridge(config: BridgeConfig): void;
  removeBridge(protocol: FederationProtocol): void;
  getBridge(protocol: FederationProtocol): BridgeConfig | null;
  linkIdentity(localId: string, remoteId: string, protocol: FederationProtocol, displayName: string): RemoteIdentity;
  getLinkedIdentity(localId: string): RemoteIdentity[];
  bridgeMessage(protocol: FederationProtocol, msg: Omit<BridgedMessage, "bridgeId" | "direction">): BridgedMessage;
  getBridgedMessages(roomId: string): BridgedMessage[];
  getStatus(): BridgeStatus[];
}

export function createFederationBridge(): FederationBridge {
  const bridges = new Map<FederationProtocol, BridgeConfig>();
  const identities = new Map<string, RemoteIdentity[]>();
  const messages = new Map<string, BridgedMessage[]>();

  return {
    addBridge(config: BridgeConfig): void {
      bridges.set(config.protocol, config);
    },

    removeBridge(protocol: FederationProtocol): void {
      bridges.delete(protocol);
    },

    getBridge(protocol: FederationProtocol) { return bridges.get(protocol) ?? null; },

    linkIdentity(localId: string, remoteId: string, protocol: FederationProtocol, displayName: string): RemoteIdentity {
      const entry: RemoteIdentity = { remoteId, localId, displayName, protocol, linkedAt: new Date().toISOString() };
      const existing = identities.get(localId) ?? [];
      existing.push(entry);
      identities.set(localId, existing);
      return entry;
    },

    getLinkedIdentity(localId: string) { return identities.get(localId) ?? []; },

    bridgeMessage(protocol: FederationProtocol, msg: Omit<BridgedMessage, "bridgeId" | "direction">): BridgedMessage {
      const id = `bridge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const entry: BridgedMessage = { ...msg, bridgeId: id, direction: "outbound" };
      const existing = messages.get(msg.roomId) ?? [];
      existing.push(entry);
      messages.set(msg.roomId, existing);
      return entry;
    },

    getBridgedMessages(roomId: string) { return messages.get(roomId) ?? []; },

    getStatus(): BridgeStatus[] {
      return [...bridges.entries()].map(([protocol, _config]) => ({
        protocol,
        connected: true,
        lastSyncAt: new Date().toISOString(),
        messageCount: [...messages.values()].flat().filter((m) => m.protocol === protocol).length,
        errorCount: 0,
      }));
    },
  };
}
