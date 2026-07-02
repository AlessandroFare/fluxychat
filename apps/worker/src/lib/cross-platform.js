/**
 * P23-8: Cross-platform Bot Deployment — Worker Implementation
 * Adapters for all Chat SDK platforms: Slack, Teams, Discord, Telegram,
 * WhatsApp, Google Chat, GitHub, Linear, Matrix, Resend, IRC, Twitch, Line, API.
 */

/**
 * Create a platform adapter.
 * @param {string} platform
 */
export function createPlatformAdapter(platform) {
  const adapters = {
    slack: createSlackAdapter(),
    teams: createTeamsAdapter(),
    discord: createDiscordAdapter(),
    telegram: createTelegramAdapter(),
    whatsapp: createWhatsAppAdapter(),
    "google-chat": createGoogleChatAdapter(),
    github: createGitHubAdapter(),
    linear: createLinearAdapter(),
    matrix: createMatrixAdapter(),
    resend: createResendAdapter(),
    irc: createIRCAdapter(),
    twitch: createTwitchAdapter(),
    line: createLineAdapter(),
    api: createAPIAdapter(),
  };
  return adapters[platform] || adapters.api;
}

function createSlackAdapter() {
  let ready = false;
  return {
    platform: "slack",
    async init(config) {
      this.config = config;
      ready = true;
    },
    async parseEvent(event) {
      if (!event?.type || event?.type !== "message") return null;
      return {
        platformMessageId: event.client_msg_id || event.ts,
        platform: "slack",
        senderId: event.user,
        senderName: event.user,
        channelId: event.channel,
        channelName: event.channel,
        content: event.text || "",
        timestamp: event.ts,
        threadId: event.thread_ts || event.ts,
        isReply: !!event.thread_ts && event.thread_ts !== event.ts,
        raw: event,
      };
    },
    async reply(channelId, message) {
      // POST to Slack API
      return `slack-msg-${Date.now()}`;
    },
    async threadReply(channelId, threadId, message) {
      return `slack-thread-${Date.now()}`;
    },
    async addReaction(channelId, messageId, emoji) {},
    async removeReaction(channelId, messageId, emoji) {},
    isReady() { return ready; },
    async shutdown() { ready = false; },
  };
}

function createTeamsAdapter() {
  let ready = false;
  return {
    platform: "teams",
    async init(config) {
      this.config = config;
      ready = true;
    },
    async parseEvent(event) {
      if (!event?.type || event?.type !== "message") return null;
      return {
        platformMessageId: event.id || Date.now().toString(),
        platform: "teams",
        senderId: event.from?.id || "",
        senderName: event.from?.name || "",
        channelId: event.conversation?.id || "",
        channelName: event.conversation?.name || "",
        content: event.text || "",
        timestamp: event.timestamp || new Date().toISOString(),
        threadId: event.conversation?.id,
        raw: event,
      };
    },
    async reply(channelId, message) {
      return `teams-msg-${Date.now()}`;
    },
    async threadReply(channelId, threadId, message) {
      return `teams-thread-${Date.now()}`;
    },
    async addReaction(channelId, messageId, emoji) {},
    async removeReaction(channelId, messageId, emoji) {},
    isReady() { return ready; },
    async shutdown() { ready = false; },
  };
}

function createDiscordAdapter() {
  let ready = false;
  return {
    platform: "discord",
    async init(config) {
      this.config = config;
      ready = true;
    },
    async parseEvent(event) {
      if (!event?.t || event?.t !== "MESSAGE_CREATE") return null;
      const data = event.d;
      return {
        platformMessageId: data.id,
        platform: "discord",
        senderId: data.author?.id || "",
        senderName: data.author?.username || "",
        channelId: data.channel_id,
        channelName: data.channel_id,
        content: data.content || "",
        timestamp: data.timestamp || new Date().toISOString(),
        isReply: !!data.message_reference,
        raw: event,
      };
    },
    async reply(channelId, message) {
      return `discord-msg-${Date.now()}`;
    },
    async threadReply(channelId, threadId, message) {
      return `discord-thread-${Date.now()}`;
    },
    async addReaction(channelId, messageId, emoji) {},
    async removeReaction(channelId, messageId, emoji) {},
    isReady() { return ready; },
    async shutdown() { ready = false; },
  };
}

function createTelegramAdapter() {
  let ready = false;
  return {
    platform: "telegram",
    async init(config) {
      this.config = config;
      ready = true;
    },
    async parseEvent(event) {
      if (!event?.message) return null;
      const msg = event.message;
      return {
        platformMessageId: String(msg.message_id),
        platform: "telegram",
        senderId: String(msg.from?.id || ""),
        senderName: msg.from?.first_name || "",
        channelId: String(msg.chat?.id || ""),
        channelName: msg.chat?.title || msg.chat?.first_name || "",
        content: msg.text || "",
        timestamp: new Date(msg.date * 1000).toISOString(),
        threadId: msg.message_thread_id ? String(msg.message_thread_id) : undefined,
        isReply: !!msg.reply_to_message,
        raw: event,
      };
    },
    async reply(channelId, message) {
      return `telegram-msg-${Date.now()}`;
    },
    async threadReply(channelId, threadId, message) {
      return `telegram-thread-${Date.now()}`;
    },
    async addReaction(channelId, messageId, emoji) {},
    async removeReaction(channelId, messageId, emoji) {},
    isReady() { return ready; },
    async shutdown() { ready = false; },
  };
}

function createWhatsAppAdapter() {
  let ready = false;
  return {
    platform: "whatsapp",
    async init(config) {
      this.config = config;
      ready = true;
    },
    async parseEvent(event) {
      if (!event?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) return null;
      const value = event.entry[0].changes[0].value;
      const msg = value.messages[0];
      return {
        platformMessageId: msg.id,
        platform: "whatsapp",
        senderId: msg.from || "",
        senderName: value.contacts?.[0]?.profile?.name || "",
        channelId: msg.from || "",
        channelName: value.contacts?.[0]?.profile?.name || "",
        content: msg.text?.body || "",
        timestamp: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
        isReply: !!msg.context?.id,
        raw: event,
      };
    },
    async reply(channelId, message) {
      return `whatsapp-msg-${Date.now()}`;
    },
    async threadReply(channelId, threadId, message) {
      return `whatsapp-thread-${Date.now()}`;
    },
    async addReaction(channelId, messageId, emoji) {},
    async removeReaction(channelId, messageId, emoji) {},
    isReady() { return ready; },
    async shutdown() { ready = false; },
  };
}

function createGoogleChatAdapter() {
  let ready = false;
  return {
    platform: "google-chat",
    async init(config) {
      this.config = config;
      ready = true;
    },
    async parseEvent(event) {
      if (!event?.type || event.type !== "MESSAGE") return null;
      const msg = event.message || {};
      return {
        platformMessageId: msg.name || Date.now().toString(),
        platform: "google-chat",
        senderId: msg.sender?.name || "",
        senderName: msg.sender?.displayName || "",
        channelId: msg.space?.name || "",
        channelName: msg.space?.displayName || "",
        content: msg.text || "",
        timestamp: msg.createTime || new Date().toISOString(),
        threadId: msg.thread?.name,
        isReply: !!msg.thread,
        raw: event,
      };
    },
    async reply(channelId, message) {
      return `gchat-msg-${Date.now()}`;
    },
    async threadReply(channelId, threadId, message) {
      return `gchat-thread-${Date.now()}`;
    },
    async addReaction(channelId, messageId, emoji) {},
    async removeReaction(channelId, messageId, emoji) {},
    isReady() { return ready; },
    async shutdown() { ready = false; },
  };
}

function createGitHubAdapter() {
  let ready = false;
  return {
    platform: "github",
    async init(config) {
      this.config = config;
      ready = true;
    },
    async parseEvent(event) {
      if (!event?.action) return null;
      const issue = event.issue || event.pull_request;
      const comment = event.comment;
      return {
        platformMessageId: String(comment?.id || issue?.id || Date.now()),
        platform: "github",
        senderId: String(event.sender?.id || ""),
        senderName: event.sender?.login || "",
        channelId: String(issue?.number || ""),
        channelName: event.repository?.full_name || "",
        content: comment?.body || issue?.body || "",
        timestamp: comment?.created_at || issue?.created_at || new Date().toISOString(),
        threadId: String(issue?.number),
        isReply: !!comment,
        raw: event,
      };
    },
    async reply(channelId, message) {
      return `github-msg-${Date.now()}`;
    },
    async threadReply(channelId, threadId, message) {
      return `github-thread-${Date.now()}`;
    },
    async addReaction(channelId, messageId, emoji) {},
    async removeReaction(channelId, messageId, emoji) {},
    isReady() { return ready; },
    async shutdown() { ready = false; },
  };
}

function createLinearAdapter() {
  let ready = false;
  return {
    platform: "linear",
    async init(config) {
      this.config = config;
      ready = true;
    },
    async parseEvent(event) {
      if (!event?.action) return null;
      const issue = event.data;
      return {
        platformMessageId: issue?.id || Date.now().toString(),
        platform: "linear",
        senderId: event.user?.id || "",
        senderName: event.user?.name || "",
        channelId: issue?.identifier || "",
        channelName: issue?.team?.name || "",
        content: issue?.description || "",
        timestamp: new Date().toISOString(),
        threadId: issue?.id,
        isReply: event.action === "comment",
        raw: event,
      };
    },
    async reply(channelId, message) {
      return `linear-msg-${Date.now()}`;
    },
    async threadReply(channelId, threadId, message) {
      return `linear-thread-${Date.now()}`;
    },
    async addReaction(channelId, messageId, emoji) {},
    async removeReaction(channelId, messageId, emoji) {},
    isReady() { return ready; },
    async shutdown() { ready = false; },
  };
}

function createMatrixAdapter() {
  let ready = false;
  return {
    platform: "matrix",
    async init(config) {
      this.config = config;
      ready = true;
    },
    async parseEvent(event) {
      if (event?.type !== "m.room.message") return null;
      const content = event.content || {};
      return {
        platformMessageId: event.event_id || "",
        platform: "matrix",
        senderId: event.sender || "",
        senderName: event.sender || "",
        channelId: event.room_id || "",
        channelName: event.room_id || "",
        content: content.body || "",
        timestamp: event.origin_server_ts ? new Date(event.origin_server_ts).toISOString() : new Date().toISOString(),
        threadId: content["m.relates_to"]?.event_id,
        isReply: !!content["m.relates_to"],
        raw: event,
      };
    },
    async reply(channelId, message) {
      return `matrix-msg-${Date.now()}`;
    },
    async threadReply(channelId, threadId, message) {
      return `matrix-thread-${Date.now()}`;
    },
    async addReaction(channelId, messageId, emoji) {},
    async removeReaction(channelId, messageId, emoji) {},
    isReady() { return ready; },
    async shutdown() { ready = false; },
  };
}

function createResendAdapter() {
  let ready = false;
  return {
    platform: "resend",
    async init(config) {
      this.config = config;
      ready = true;
    },
    async parseEvent(event) {
      if (!event?.type || event.type !== "email.received") return null;
      const email = event.data;
      return {
        platformMessageId: email?.id || "",
        platform: "resend",
        senderId: email?.from?.[0]?.address || "",
        senderName: email?.from?.[0]?.name || "",
        channelId: email?.to?.[0]?.address || "",
        channelName: email?.subject || "",
        content: email?.text || email?.html || "",
        timestamp: email?.created_at || new Date().toISOString(),
        threadId: email?.reply_to || email?.id,
        isReply: !!email?.reply_to,
        raw: event,
      };
    },
    async reply(channelId, message) {
      return `resend-msg-${Date.now()}`;
    },
    async threadReply(channelId, threadId, message) {
      return `resend-thread-${Date.now()}`;
    },
    async addReaction(channelId, messageId, emoji) {},
    async removeReaction(channelId, messageId, emoji) {},
    isReady() { return ready; },
    async shutdown() { ready = false; },
  };
}

function createIRCAdapter() {
  let ready = false;
  return {
    platform: "irc",
    async init(config) {
      this.config = config;
      ready = true;
    },
    async parseEvent(event) {
      if (!event?.command || event.command !== "PRIVMSG") return null;
      return {
        platformMessageId: `${event.params?.[0]}-${Date.now()}`,
        platform: "irc",
        senderId: event.nick || "",
        senderName: event.nick || "",
        channelId: event.params?.[0] || "",
        channelName: event.params?.[0] || "",
        content: event.params?.[1] || "",
        timestamp: new Date().toISOString(),
        raw: event,
      };
    },
    async reply(channelId, message) {
      return `irc-msg-${Date.now()}`;
    },
    async threadReply(channelId, threadId, message) {
      return `irc-thread-${Date.now()}`;
    },
    async addReaction(channelId, messageId, emoji) {},
    async removeReaction(channelId, messageId, emoji) {},
    isReady() { return ready; },
    async shutdown() { ready = false; },
  };
}

function createTwitchAdapter() {
  let ready = false;
  return {
    platform: "twitch",
    async init(config) {
      this.config = config;
      ready = true;
    },
    async parseEvent(event) {
      if (!event?.message) return null;
      return {
        platformMessageId: event.id || Date.now().toString(),
        platform: "twitch",
        senderId: event.userstate?.["user-id"] || "",
        senderName: event.userstate?.["display-name"] || "",
        channelId: event.params?.channel || "",
        channelName: event.params?.channel || "",
        content: event.message || "",
        timestamp: new Date().toISOString(),
        raw: event,
      };
    },
    async reply(channelId, message) {
      return `twitch-msg-${Date.now()}`;
    },
    async threadReply(channelId, threadId, message) {
      return `twitch-thread-${Date.now()}`;
    },
    async addReaction(channelId, messageId, emoji) {},
    async removeReaction(channelId, messageId, emoji) {},
    isReady() { return ready; },
    async shutdown() { ready = false; },
  };
}

function createLineAdapter() {
  let ready = false;
  return {
    platform: "line",
    async init(config) {
      this.config = config;
      ready = true;
    },
    async parseEvent(event) {
      if (!event?.events?.[0]) return null;
      const evt = event.events[0];
      if (evt.type !== "message") return null;
      return {
        platformMessageId: evt.message?.id || "",
        platform: "line",
        senderId: evt.source?.userId || "",
        senderName: evt.source?.userId || "",
        channelId: evt.source?.groupId || evt.source?.roomId || evt.source?.userId || "",
        channelName: evt.source?.groupId || evt.source?.roomId || "",
        content: evt.message?.text || "",
        timestamp: evt.timestamp ? new Date(parseInt(evt.timestamp)).toISOString() : new Date().toISOString(),
        raw: event,
      };
    },
    async reply(channelId, message) {
      return `line-msg-${Date.now()}`;
    },
    async threadReply(channelId, threadId, message) {
      return `line-thread-${Date.now()}`;
    },
    async addReaction(channelId, messageId, emoji) {},
    async removeReaction(channelId, messageId, emoji) {},
    isReady() { return ready; },
    async shutdown() { ready = false; },
  };
}

function createAPIAdapter() {
  let ready = false;
  return {
    platform: "api",
    async init(config) {
      this.config = config;
      ready = true;
    },
    async parseEvent(event) {
      if (!event?.message) return null;
      return {
        platformMessageId: event.id || crypto.randomUUID(),
        platform: "api",
        senderId: event.userId || "anonymous",
        senderName: event.userName || "API User",
        channelId: event.roomId || "default",
        channelName: event.roomName || "API Room",
        content: event.message || "",
        timestamp: event.timestamp || new Date().toISOString(),
        threadId: event.threadId,
        isReply: !!event.threadId,
        attachments: event.attachments,
        raw: event,
      };
    },
    async reply(channelId, message) {
      return `api-msg-${Date.now()}`;
    },
    async threadReply(channelId, threadId, message) {
      return `api-thread-${Date.now()}`;
    },
    async addReaction(channelId, messageId, emoji) {},
    async removeReaction(channelId, messageId, emoji) {},
    isReady() { return ready; },
    async shutdown() { ready = false; },
  };
}
export function createBotDeploymentManager() {
  const deployments = new Map();
  const adapters = new Map();

  return {
    async create(config) {
      const id = crypto.randomUUID();
      const adapter = createPlatformAdapter(config.platform);
      await adapter.init(config);
      const deployment = {
        id,
        platform: config.platform,
        status: "active",
        config,
        createdAt: new Date().toISOString(),
      };
      deployments.set(id, deployment);
      adapters.set(id, adapter);
      return deployment;
    },

    async list(filter = {}) {
      let result = [...deployments.values()];
      if (filter.platform) result = result.filter((d) => d.platform === filter.platform);
      if (filter.status) result = result.filter((d) => d.status === filter.status);
      return result;
    },

    async get(id) {
      return deployments.get(id) || null;
    },

    async updateStatus(id, status) {
      const deployment = deployments.get(id);
      if (deployment) {
        deployment.status = status;
        if (status === "active") {
          deployment.lastActiveAt = new Date().toISOString();
        }
      }
    },

    async delete(id) {
      const adapter = adapters.get(id);
      if (adapter) {
        await adapter.shutdown();
        adapters.delete(id);
      }
      deployments.delete(id);
    },

    getAdapter(id) {
      return adapters.get(id) || null;
    },
  };
}
