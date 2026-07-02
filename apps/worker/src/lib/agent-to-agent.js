/**
 * P24-11: Agent-to-Agent Communication — Worker Implementation
 */

/**
 * Create an agent communication bus.
 */
export function createAgentCommunicationBus() {
  const handlers = new Map();
  const history = new Map(); // roomId -> AgentMessage[]

  return {
    async send(message) {
      const fullMessage = {
        ...message,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };

      // Route to handler
      const handler = handlers.get(message.toAgentId);
      if (handler) {
        try {
          const response = await handler.handle(fullMessage);
          if (response) {
            // Store response in history
            const roomHistory = history.get(message.roomId) || [];
            roomHistory.push(fullMessage);
            if (roomHistory.length > 100) roomHistory.shift();
            history.set(message.roomId, roomHistory);
          }
        } catch (err) {
          console.error(`Agent message handler error:`, err.message);
        }
      }

      return fullMessage.id;
    },

    async broadcast(roomId, projectId, content, fromAgentId) {
      const message = {
        id: crypto.randomUUID(),
        fromAgentId,
        toAgentId: "*",
        roomId,
        projectId,
        type: "broadcast",
        content,
        timestamp: new Date().toISOString(),
      };

      const roomHistory = history.get(roomId) || [];
      roomHistory.push(message);
      if (roomHistory.length > 100) roomHistory.shift();
      history.set(roomId, roomHistory);

      // Notify all handlers
      for (const [agentId, handler] of handlers) {
        if (agentId !== fromAgentId) {
          try {
            await handler.handle(message);
          } catch (err) {
            console.error(`Broadcast handler error for ${agentId}:`, err.message);
          }
        }
      }
    },

    registerHandler(agentId, handler) {
      handlers.set(agentId, handler);
    },

    unregisterHandler(agentId) {
      handlers.delete(agentId);
    },

    async getHistory(roomId, limit = 50) {
      const roomHistory = history.get(roomId) || [];
      return roomHistory.slice(-limit);
    },
  };
}

/**
 * Delegate a task to another agent.
 * @param {Object} bus
 * @param {string} fromAgentId
 * @param {string} toAgentId
 * @param {string} roomId
 * @param {string} projectId
 * @param {string} task
 * @param {Object} options
 */
export async function delegateToAgent(bus, fromAgentId, toAgentId, roomId, projectId, task, options = {}) {
  return bus.send({
    fromAgentId,
    toAgentId,
    roomId,
    projectId,
    type: "delegation",
    content: task,
    priority: options.priority || "normal",
    ttlMs: options.ttlMs || 300_000,
    metadata: options.metadata,
  });
}
