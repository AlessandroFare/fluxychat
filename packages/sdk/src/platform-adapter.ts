export type AdapterPlatform = "whatsapp" | "telegram" | "line" | "viber" | "imessage" | "messenger";

export interface PlatformMessage {
  id: string;
  platform: AdapterPlatform;
  content: string;
  userId: string;
  roomId: string;
  timestamp: string;
}

export interface PlatformAdapterConfig {
  platform: AdapterPlatform;
  apiKey?: string;
  webhookUrl?: string;
  enabled: boolean;
}

export interface PlatformAdapterApi {
  getSupportedPlatforms(): AdapterPlatform[];
  send(config: PlatformAdapterConfig, message: string, target: string): Promise<PlatformMessage>;
  register(id: string): string;
}

const adapters: Record<AdapterPlatform, { name: string; idPrefix: string }> = {
  whatsapp: { name: "WhatsApp Business", idPrefix: "wa_" },
  telegram: { name: "Telegram", idPrefix: "tg_" },
  line: { name: "Line", idPrefix: "ln_" },
  viber: { name: "Viber", idPrefix: "vb_" },
  imessage: { name: "iMessage", idPrefix: "im_" },
  messenger: { name: "Messenger", idPrefix: "msgr_" },
};

let msgId = 0;

export function createPlatformAdapter(): PlatformAdapterApi {
  return {
    getSupportedPlatforms() { return Object.keys(adapters) as AdapterPlatform[]; },
    async send(config, message, target) {
      const a = adapters[config.platform];
      if (!a) throw new Error(`Unsupported platform: ${config.platform}`);
      return { id: `${a.idPrefix}${++msgId}`, platform: config.platform, content: message, userId: target, roomId: `${a.idPrefix}${target}`, timestamp: new Date().toISOString() };
    },
    register(id) { return `webhook_${id}_${Date.now()}`; },
  };
}
