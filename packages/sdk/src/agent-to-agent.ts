/**
 * P24-11: Agent-to-Agent Communication
 * Inter-agent messaging and delegation.
 */

export interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  roomId: string;
  projectId: string;
  type: "delegation" | "query" | "response" | "broadcast";
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  /** Parent message ID for threading */
  parentMessageId?: string;
  /** Priority level */
  priority?: "low" | "normal" | "high" | "urgent";
  /** TTL in milliseconds */
  ttlMs?: number;
}

export interface AgentMessageHandler {
  /** Handle an incoming message from another agent */
  handle(message: AgentMessage): Promise<string | null>;
}

export interface AgentCommunicationBus {
  /** Send a message to another agent */
  send(message: Omit<AgentMessage, "id" | "timestamp">): Promise<string>;
  /** Broadcast a message to all agents in a room */
  broadcast(roomId: string, projectId: string, content: string, fromAgentId: string): Promise<void>;
  /** Register a message handler for an agent */
  registerHandler(agentId: string, handler: AgentMessageHandler): void;
  /** Unregister a handler */
  unregisterHandler(agentId: string): void;
  /** Get message history for a room */
  getHistory(roomId: string, limit?: number): Promise<AgentMessage[]>;
}

export declare function createAgentCommunicationBus(): AgentCommunicationBus;

/**
 * Delegate a task to another agent.
 */
export declare function delegateToAgent(
  bus: AgentCommunicationBus,
  fromAgentId: string,
  toAgentId: string,
  roomId: string,
  projectId: string,
  task: string,
  options?: { priority?: string; ttlMs?: number; metadata?: Record<string, unknown> },
): Promise<string>;
