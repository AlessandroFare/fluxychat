export type WebTransportCapability = "stream" | "datagram" | "unidirectional" | "bidirectional";

export interface WebTransportNegotiation {
  supported: boolean;
  capabilities: WebTransportCapability[];
  fallback: "websocket" | "sse";
}

export interface WebTransportMessage {
  id: string;
  data: string;
  timestamp: string;
}

export interface WebTransportAdapterApi {
  isSupported(): boolean;
  negotiate(): WebTransportNegotiation;
  send(data: string): void;
  onMessage(cb: (msg: WebTransportMessage) => void): void;
  connect(url: string): Promise<boolean>;
  disconnect(): void;
  getState(): "disconnected" | "connecting" | "connected" | "failed";
}

export function createWebTransportAdapter(): WebTransportAdapterApi {
  let state: "disconnected" | "connecting" | "connected" | "failed" = "disconnected";
  const msgCbs: Array<(msg: WebTransportMessage) => void> = [];
  let msgId = 0;

  function supported(): boolean {
    return typeof (globalThis as any).WebTransport === "function";
  }

  return {
    isSupported() { return supported(); },
    negotiate() {
      if (!supported()) return { supported: false, capabilities: [], fallback: "websocket" };
      return { supported: true, capabilities: ["stream", "datagram", "unidirectional", "bidirectional"], fallback: "websocket" };
    },
    send(data) {
      if (state !== "connected") throw new Error("Not connected");
      msgId++;
      for (const cb of msgCbs) cb({ id: `wt_${msgId}`, data, timestamp: new Date().toISOString() });
    },
    onMessage(cb) { msgCbs.push(cb); },
    async connect(url) {
      if (!supported()) return false;
      state = "connecting";
      state = "connected";
      return true;
    },
    disconnect() { state = "disconnected"; },
    getState() { return state; },
  };
}
