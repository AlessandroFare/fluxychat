export interface WaitingTicket {
  id: string;
  userId: string;
  position: number;
  estimatedWaitMs: number;
  status: "queued" | "connecting" | "connected" | "abandoned";
  priority: "normal" | "vip" | "urgent";
  enteredAt: number;
  connectedAt?: number;
  metadata: Record<string, unknown>;
}

export interface WaitingRoomStats {
  totalQueued: number;
  avgWaitMs: number;
  maxWaitMs: number;
  abandonmentRate: number;
  agentsAvailable: number;
}

export interface VirtualWaitingRoom {
  enqueue(userId: string, priority?: WaitingTicket["priority"], metadata?: Record<string, unknown>): WaitingTicket;
  dequeue(agentId: string): WaitingTicket | undefined;
  getTicket(ticketId: string): WaitingTicket | undefined;
  getUserTicket(userId: string): WaitingTicket | undefined;
  peek(limit?: number): WaitingTicket[];
  abandon(ticketId: string): void;
  connect(ticketId: string): WaitingTicket;
  getStats(): WaitingRoomStats;
  setAgentCount(count: number): void;
}

export function createVirtualWaitingRoom(): VirtualWaitingRoom {
  const queue: WaitingTicket[] = [];
  const tickets = new Map<string, WaitingTicket>();
  let agentCount = 1;
  let ticketCounter = 0;

  function recalculatePositions() {
    queue.sort((a, b) => {
      const priorityOrder = { urgent: 0, vip: 1, normal: 2 };
      const cmp = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (cmp !== 0) return cmp;
      return a.enteredAt - b.enteredAt;
    });
    queue.forEach((t, i) => {
      t.position = i + 1;
      t.estimatedWaitMs = (i / Math.max(agentCount, 1)) * 60000;
    });
  }

  return {
    enqueue(userId, priority = "normal", metadata = {}) {
      const id = `ticket-${++ticketCounter}`;
      const ticket: WaitingTicket = {
        id, userId, position: queue.length + 1,
        estimatedWaitMs: (queue.length / Math.max(agentCount, 1)) * 60000,
        status: "queued", priority, enteredAt: Date.now(), metadata,
      };
      queue.push(ticket);
      tickets.set(id, ticket);
      recalculatePositions();
      return { ...ticket };
    },

    dequeue(_agentId) {
      if (queue.length === 0) return undefined;
      const ticket = queue.shift()!;
      ticket.status = "connecting";
      ticket.connectedAt = Date.now();
      recalculatePositions();
      return { ...ticket };
    },

    getTicket(ticketId) {
      const t = tickets.get(ticketId);
      return t ? { ...t } : undefined;
    },

    getUserTicket(userId) {
      const t = queue.find((t) => t.userId === userId) ?? Array.from(tickets.values()).reverse().find((t) => t.userId === userId);
      return t ? { ...t } : undefined;
    },

    peek(limit = 10) {
      return queue.slice(0, limit).map((t) => ({ ...t }));
    },

    abandon(ticketId) {
      const idx = queue.findIndex((t) => t.id === ticketId);
      if (idx !== -1) {
        queue[idx].status = "abandoned";
        queue.splice(idx, 1);
        recalculatePositions();
      }
    },

    connect(ticketId) {
      const idx = queue.findIndex((t) => t.id === ticketId);
      if (idx === -1) throw new Error(`Ticket "${ticketId}" not found`);
      const ticket = queue[idx];
      ticket.status = "connected";
      ticket.connectedAt = Date.now();
      queue.splice(idx, 1);
      recalculatePositions();
      return { ...ticket };
    },

    getStats() {
      const queued = queue.filter((t) => t.status === "queued");
      const waits = queued.map((t) => Date.now() - t.enteredAt);
      const abandoned = Array.from(tickets.values()).filter((t) => t.status === "abandoned");
      return {
        totalQueued: queued.length,
        avgWaitMs: waits.length > 0 ? waits.reduce((a, b) => a + b, 0) / waits.length : 0,
        maxWaitMs: waits.length > 0 ? Math.max(...waits) : 0,
        abandonmentRate: tickets.size > 0 ? abandoned.length / tickets.size : 0,
        agentsAvailable: agentCount - Math.min(agentCount, tickets.size - abandoned.length),
      };
    },

    setAgentCount(count) {
      agentCount = Math.max(1, count);
      recalculatePositions();
    },
  };
}
