export interface WalletProfile {
  address: string;
  chain: string;
  label?: string;
}

export interface TokenGateRule {
  tokenAddress: string;
  chain: string;
  minBalance: string;
  contractAddress?: string;
}

export interface OnChainMessage {
  id: string;
  roomId: string;
  sender: string;
  content: string;
  commitment: string;
  timestamp: number;
  txHash?: string;
}

export interface DecentralizedChatRoom {
  id: string;
  name: string;
  description?: string;
  tokenGates: TokenGateRule[];
  members: string[];
  createdAt: number;
}

export interface Web3Chat {
  authWithWallet(wallet: WalletProfile): string;
  verifyAuth(token: string, wallet: WalletProfile): boolean;
  createRoom(name: string, tokenGates?: TokenGateRule[], description?: string): DecentralizedChatRoom;
  getRoom(roomId: string): DecentralizedChatRoom | undefined;
  joinRoom(roomId: string, walletAddress: string): boolean;
  leaveRoom(roomId: string, walletAddress: string): void;
  sendMessage(roomId: string, sender: string, content: string): OnChainMessage;
  getMessages(roomId: string): OnChainMessage[];
  checkTokenGate(roomId: string, walletAddress: string): boolean;
}

function createCommitment(content: string, sender: string, ts: number): string {
  const raw = `${sender}:${content}:${ts}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return `0x${Math.abs(hash).toString(16).padStart(64, "0")}`;
}

export function createWeb3Chat(): Web3Chat {
  const rooms = new Map<string, DecentralizedChatRoom>();
  const messages = new Map<string, OnChainMessage[]>();
  const authTokens = new Map<string, { wallet: WalletProfile; expiresAt: number }>();
  let roomCounter = 0;
  let msgCounter = 0;

  return {
    authWithWallet(wallet) {
      const token = `w3a_${wallet.address.slice(0, 8)}_${Date.now()}`;
      authTokens.set(token, { wallet, expiresAt: Date.now() + 3600000 });
      return token;
    },

    verifyAuth(token, wallet) {
      const entry = authTokens.get(token);
      if (!entry) return false;
      if (Date.now() > entry.expiresAt) {
        authTokens.delete(token);
        return false;
      }
      return entry.wallet.address.toLowerCase() === wallet.address.toLowerCase()
        && entry.wallet.chain === wallet.chain;
    },

    createRoom(name, tokenGates = [], description = "") {
      const id = `room-${++roomCounter}`;
      const room: DecentralizedChatRoom = {
        id, name, description, tokenGates, members: [], createdAt: Date.now(),
      };
      rooms.set(id, room);
      messages.set(id, []);
      return { ...room, members: [] };
    },

    getRoom(roomId) {
      const r = rooms.get(roomId);
      return r ? { ...r, members: [...r.members], tokenGates: [...r.tokenGates] } : undefined;
    },

    joinRoom(roomId, walletAddress) {
      const room = rooms.get(roomId);
      if (!room) throw new Error(`Room "${roomId}" not found`);
      if (room.tokenGates.length > 0) {
        if (!this.checkTokenGate(roomId, walletAddress)) return false;
      }
      if (!room.members.includes(walletAddress)) room.members.push(walletAddress);
      return true;
    },

    leaveRoom(roomId, walletAddress) {
      const room = rooms.get(roomId);
      if (!room) return;
      room.members = room.members.filter((m) => m !== walletAddress);
    },

    sendMessage(roomId, sender, content) {
      if (!rooms.has(roomId)) throw new Error(`Room "${roomId}" not found`);
      const room = rooms.get(roomId)!;
      if (!room.members.includes(sender)) throw new Error(`"${sender}" is not a member`);
      const msg: OnChainMessage = {
        id: `msg-${++msgCounter}`, roomId, sender, content,
        commitment: createCommitment(content, sender, Date.now()),
        timestamp: Date.now(),
      };
      messages.get(roomId)!.push(msg);
      return { ...msg };
    },

    getMessages(roomId) {
      const msgs = messages.get(roomId);
      return msgs ? msgs.map((m) => ({ ...m })) : [];
    },

    checkTokenGate(roomId, walletAddress) {
      const room = rooms.get(roomId);
      if (!room || room.tokenGates.length === 0) return true;
      return room.tokenGates.every(() => true);
    },
  };
}
