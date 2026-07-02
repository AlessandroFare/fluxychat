/**
 * P22-A4: Adapter catalog - static registry of official adapters with metadata.
 * Self-documenting adapter discovery for onboarding/setup UIs.
 *
 * This catalog provides metadata only. Actual adapter implementations
 * are registered via registerAdapter() in their respective modules.
 */

/**
 * @typedef {Object} AdapterInfo
 * @property {string} slug - Unique identifier
 * @property {string} name - Human-readable name
 * @property {string} description - Short description
 * @property {string} packageName - npm package name
 * @property {string} docsUrl - Documentation URL
 * @property {string[]} envVars - Required environment variables
 * @property {string[]} optionalEnvVars - Optional environment variables
 * @property {string[]} peerDeps - Peer dependencies
 * @property {'stable' | 'beta' | 'alpha' | 'deprecated'} status
 * @property {'thread' | 'channel'} lockScope
 * @property {Object} capabilities - Supported features
 * @property {string} iconEmoji - Emoji for UI display
 * @property {string} color - Brand color hex
 * @property {string[]} optionalMethods - Optional adapter methods supported
 */

/** @type {AdapterInfo[]} */
export const ADAPTER_CATALOG = [
  {
    slug: "web",
    name: "Web (REST + WebSocket)",
    description: "Built-in web client with real-time WebSocket and REST API",
    packageName: "@fluxychat/adapter-web",
    docsUrl: "/docs/adapters/web",
    envVars: [],
    optionalEnvVars: [],
    peerDeps: [],
    status: "stable",
    lockScope: "channel",
    capabilities: {
      streaming: true,
      edit: true,
      delete: true,
      reactions: true,
      threads: true,
      attachments: true,
      voiceMessages: true,
      typing: true,
      presence: true,
      readReceipts: true,
    },
    iconEmoji: "🌐",
    color: "#c2410c",
    optionalMethods: ["openDM", "postEphemeral", "postChannelMessage", "fetchChannelInfo", "fetchChannelMessages", "fetchMessage", "getChannelMembers", "getThreadMembers", "openModal"],
  },
  {
    slug: "whatsapp",
    name: "WhatsApp Business",
    description: "WhatsApp Business API integration via Meta Cloud API",
    packageName: "@fluxychat/adapter-whatsapp",
    docsUrl: "/docs/adapters/whatsapp",
    envVars: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN"],
    optionalEnvVars: ["WHATSAPP_APP_SECRET"],
    peerDeps: [],
    status: "beta",
    lockScope: "channel",
    capabilities: {
      streaming: false,
      edit: false,
      delete: false,
      reactions: true,
      threads: false,
      attachments: true,
      voiceMessages: true,
      typing: false,
      presence: false,
      readReceipts: true,
    },
    iconEmoji: "📱",
    color: "#25D366",
    optionalMethods: [],
  },
  {
    slug: "telegram",
    name: "Telegram",
    description: "Telegram Bot API integration",
    packageName: "@fluxychat/adapter-telegram",
    docsUrl: "/docs/adapters/telegram",
    envVars: ["TELEGRAM_BOT_TOKEN"],
    optionalEnvVars: ["TELEGRAM_WEBHOOK_SECRET"],
    peerDeps: [],
    status: "stable",
    lockScope: "channel",
    capabilities: {
      streaming: false,
      edit: true,
      delete: true,
      reactions: true,
      threads: true,
      attachments: true,
      voiceMessages: true,
      typing: true,
      presence: false,
      readReceipts: false,
    },
    iconEmoji: "✈️",
    color: "#0088cc",
    optionalMethods: ["openDM", "postChannelMessage", "fetchChannelInfo", "fetchChannelMessages", "fetchMessage"],
  },
  {
    slug: "slack",
    name: "Slack",
    description: "Slack app integration with Socket Mode or webhook",
    packageName: "@fluxychat/adapter-slack",
    docsUrl: "/docs/adapters/slack",
    envVars: ["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN"],
    optionalEnvVars: ["SLACK_SIGNING_SECRET", "SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET"],
    peerDeps: ["@slack/bolt"],
    status: "stable",
    lockScope: "thread",
    capabilities: {
      streaming: true,
      edit: true,
      delete: true,
      reactions: true,
      threads: true,
      attachments: true,
      voiceMessages: false,
      typing: true,
      presence: true,
      readReceipts: true,
    },
    iconEmoji: "💬",
    color: "#4A154B",
    optionalMethods: ["openDM", "postEphemeral", "postChannelMessage", "fetchChannelInfo", "fetchChannelMessages", "fetchMessage", "fetchSubject", "getChannelMembers", "getThreadMembers", "openModal"],
  },
  {
    slug: "discord",
    name: "Discord",
    description: "Discord bot integration",
    packageName: "@fluxychat/adapter-discord",
    docsUrl: "/docs/adapters/discord",
    envVars: ["DISCORD_BOT_TOKEN"],
    optionalEnvVars: ["DISCORD_APPLICATION_ID", "DISCORD_PUBLIC_KEY"],
    peerDeps: ["discord.js"],
    status: "beta",
    lockScope: "thread",
    capabilities: {
      streaming: false,
      edit: true,
      delete: true,
      reactions: true,
      threads: true,
      attachments: true,
      voiceMessages: false,
      typing: true,
      presence: true,
      readReceipts: false,
    },
    iconEmoji: "🎮",
    color: "#5865F2",
    optionalMethods: ["openDM", "postChannelMessage", "fetchChannelInfo", "fetchChannelMessages", "fetchMessage", "getChannelMembers", "getThreadMembers", "openModal"],
  },
  {
    slug: "teams",
    name: "Microsoft Teams",
    description: "Microsoft Teams bot integration via Bot Framework",
    packageName: "@fluxychat/adapter-teams",
    docsUrl: "/docs/adapters/teams",
    envVars: ["TEAMS_APP_ID", "TEAMS_APP_PASSWORD", "TEAMS_TENANT_ID"],
    optionalEnvVars: ["TEAMS_WEBHOOK_URL"],
    peerDeps: ["botbuilder"],
    status: "alpha",
    lockScope: "thread",
    capabilities: {
      streaming: false,
      edit: true,
      delete: true,
      reactions: false,
      threads: true,
      attachments: true,
      voiceMessages: false,
      typing: true,
      presence: false,
      readReceipts: false,
    },
    iconEmoji: "👥",
    color: "#6264A7",
    optionalMethods: ["openDM", "postEphemeral", "postChannelMessage", "fetchChannelInfo", "fetchChannelMessages", "fetchMessage", "fetchSubject", "getChannelMembers", "getThreadMembers", "openModal"],
  },
  {
    slug: "email",
    name: "Email (Inbound)",
    description: "Inbound email processing via webhook or polling",
    packageName: "@fluxychat/adapter-email",
    docsUrl: "/docs/adapters/email",
    envVars: ["EMAIL_WEBHOOK_SECRET"],
    optionalEnvVars: ["EMAIL_IMAP_HOST", "EMAIL_IMAP_USER", "EMAIL_IMAP_PASS"],
    peerDeps: [],
    status: "beta",
    lockScope: "channel",
    capabilities: {
      streaming: false,
      edit: false,
      delete: false,
      reactions: false,
      threads: false,
      attachments: true,
      voiceMessages: false,
      typing: false,
      presence: false,
      readReceipts: false,
    },
    iconEmoji: "📧",
    color: "#EA4335",
    optionalMethods: ["fetchSubject"],
  },
  {
    slug: "sms",
    name: "SMS (Twilio)",
    description: "SMS messaging via Twilio",
    packageName: "@fluxychat/adapter-sms",
    docsUrl: "/docs/adapters/sms",
    envVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
    optionalEnvVars: [],
    peerDeps: ["twilio"],
    status: "stable",
    lockScope: "channel",
    capabilities: {
      streaming: false,
      edit: false,
      delete: false,
      reactions: false,
      threads: false,
      attachments: false,
      voiceMessages: false,
      typing: false,
      presence: false,
      readReceipts: false,
    },
    iconEmoji: "💬",
    color: "#F22F46",
    optionalMethods: [],
  },
  {
    slug: "webhook",
    name: "Generic Webhook",
    description: "Custom webhook integration for any platform",
    packageName: "@fluxychat/adapter-webhook",
    docsUrl: "/docs/adapters/webhook",
    envVars: ["WEBHOOK_SECRET"],
    optionalEnvVars: [],
    peerDeps: [],
    status: "stable",
    lockScope: "channel",
    capabilities: {
      streaming: false,
      edit: false,
      delete: false,
      reactions: false,
      threads: false,
      attachments: true,
      voiceMessages: false,
      typing: false,
      presence: false,
      readReceipts: false,
    },
    iconEmoji: "🔗",
    color: "#6B7280",
    optionalMethods: [],
  },
  {
    slug: "matrix",
    name: "Matrix",
    description: "Matrix protocol integration via matrix-js-sdk",
    packageName: "@fluxychat/adapter-matrix",
    docsUrl: "/docs/adapters/matrix",
    envVars: ["MATRIX_HOMESERVER", "MATRIX_ACCESS_TOKEN"],
    optionalEnvVars: ["MATRIX_USER_ID"],
    peerDeps: ["matrix-js-sdk"],
    status: "alpha",
    lockScope: "channel",
    capabilities: {
      streaming: false,
      edit: true,
      delete: true,
      reactions: true,
      threads: true,
      attachments: true,
      voiceMessages: true,
      typing: true,
      presence: true,
      readReceipts: true,
    },
    iconEmoji: "🔮",
    color: "#0DBD8B",
    optionalMethods: ["openDM", "postChannelMessage", "fetchChannelInfo", "fetchChannelMessages", "fetchMessage", "getChannelMembers", "getThreadMembers"],
  },
];

/**
 * Get adapter info by slug.
 * @param {string} slug
 * @returns {AdapterInfo|undefined}
 */
export function getAdapterInfo(slug) {
  return ADAPTER_CATALOG.find((a) => a.slug === slug);
}

/**
 * List all adapters, optionally filtered by status.
 * @param {{status?: string}} filter
 * @returns {AdapterInfo[]}
 */
export function listAdapterCatalog(filter) {
  if (!filter?.status) return ADAPTER_CATALOG;
  return ADAPTER_CATALOG.filter((a) => a.status === filter.status);
}

/**
 * Get adapter slugs that require specific env vars.
 * @param {string} envVar
 * @returns {string[]}
 */
export function getAdaptersRequiringEnvVar(envVar) {
  return ADAPTER_CATALOG.filter((a) => a.envVars.includes(envVar)).map((a) => a.slug);
}

/**
 * Validate that all required env vars are set for an adapter.
 * @param {string} slug
 * @param {Object} env - Worker env bindings
 * @returns {{ok: boolean, missing?: string[]}}
 */
export function validateAdapterEnv(slug, env) {
  const info = getAdapterInfo(slug);
  if (!info) return { ok: false, missing: ["adapter_not_found"] };

  const missing = info.envVars.filter((v) => !env[v]);
  if (missing.length > 0) return { ok: false, missing };

  return { ok: true };
}

/**
 * Get adapters that can be enabled (all env vars present).
 * @param {Object} env - Worker env bindings
 * @returns {AdapterInfo[]}
 */
export function getAvailableAdapters(env) {
  return ADAPTER_CATALOG.filter((a) => {
    return a.envVars.every((v) => env[v]);
  });
}
