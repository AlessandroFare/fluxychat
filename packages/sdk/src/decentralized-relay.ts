export interface RelayPeer {
  id: string;
  address: string;
  latencyMs: number;
  lastSeen: string;
  isConnected: boolean;
}

export interface RelayMessage {
  id: string;
  from: string;
  to: string;
  payload: string;
  timestamp: string;
  hopCount: number;
}

export interface DecentralizedRelayApi {
  registerPeer(id: string, address: string): void;
  unregisterPeer(id: string): void;
  getPeers(): RelayPeer[];
  send(from: string, to: string, payload: string): RelayMessage;
  route(message: RelayMessage): RelayMessage | null;
  broadcast(from: string, payload: string): RelayMessage[];
  getRoute(from: string, to: string): string[];
  setLatency(peerId: string, latencyMs: number): void;
}

export function createDecentralizedRelay(): DecentralizedRelayApi {
  const relayPeers = new Map<string, RelayPeer>();
  let relayMsgId = 0;
  return {
    registerPeer(id, address) {
      relayPeers.set(id, { id, address, latencyMs: 0, lastSeen: new Date().toISOString(), isConnected: true });
    },
    unregisterPeer(id) { relayPeers.delete(id); },
    getPeers() { return [...relayPeers.values()]; },
    send(from, to, payload) {
      const msg: RelayMessage = { id: `relay_${++relayMsgId}`, from, to, payload, timestamp: new Date().toISOString(), hopCount: 0 };
      return msg;
    },
    route(message) {
      const peer = relayPeers.get(message.to);
      if (!peer || !peer.isConnected) return null;
      return { ...message, hopCount: message.hopCount + 1 };
    },
    broadcast(from, payload) {
      const msgs: RelayMessage[] = [];
      for (const [id] of relayPeers) {
        if (id !== from) msgs.push({ id: `relay_${++relayMsgId}`, from, to: id, payload, timestamp: new Date().toISOString(), hopCount: 0 });
      }
      return msgs;
    },
    getRoute(from, to) {
      const peers = [...relayPeers.keys()];
      const idx1 = peers.indexOf(from);
      const idx2 = peers.indexOf(to);
      if (idx1 < 0 || idx2 < 0) return [];
      return [from, ...peers.slice(Math.min(idx1, idx2) + 1, Math.max(idx1, idx2)), to];
    },
    setLatency(peerId, latencyMs) {
      const p = relayPeers.get(peerId);
      if (p) p.latencyMs = latencyMs;
    },
  };
}
