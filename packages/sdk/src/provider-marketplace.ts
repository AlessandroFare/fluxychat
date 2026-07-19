export interface AiProvider {
  id: string;
  name: string;
  models: AiModel[];
  baseUrl?: string;
  requiresApiKey: boolean;
  supportsStreaming: boolean;
  docsUrl?: string;
}

export interface AiModel {
  id: string;
  name: string;
  providerId: string;
  capabilities: string[];
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
}

export interface ProviderKey {
  id: string;
  providerId: string;
  key: string;
  label?: string;
  isActive: boolean;
  quota?: { maxRequestsPerMinute: number; remaining: number };
}

export interface ProviderMarketplace {
  registerProvider(provider: AiProvider): void;
  getProvider(id: string): AiProvider | undefined;
  listProviders(): AiProvider[];
  listModels(providerId?: string): AiModel[];
  addKey(providerId: string, key: string, label?: string): ProviderKey;
  removeKey(id: string): boolean;
  getKeys(providerId: string): ProviderKey[];
  getActiveKey(providerId: string): ProviderKey | undefined;
  setActiveKey(id: string): void;
}

export function createProviderMarketplace(): ProviderMarketplace {
  const providers = new Map<string, AiProvider>();
  const keys = new Map<string, ProviderKey>();
  let keyCounter = 0;

  return {
    registerProvider(provider) {
      providers.set(provider.id, { ...provider });
    },

    getProvider(id) {
      return providers.get(id);
    },

    listProviders() {
      return Array.from(providers.values());
    },

    listModels(providerId?: string) {
      const all: AiModel[] = [];
      for (const p of providers.values()) {
        if (providerId && p.id !== providerId) continue;
        all.push(...p.models);
      }
      return all;
    },

    addKey(providerId, key, label) {
      const id = `key-${++keyCounter}`;
      const pk: ProviderKey = { id, providerId, key, label, isActive: true };
      keys.set(id, pk);
      return { ...pk };
    },

    removeKey(id) {
      return keys.delete(id);
    },

    getKeys(providerId) {
      return Array.from(keys.values()).filter((k) => k.providerId === providerId);
    },

    getActiveKey(providerId) {
      return Array.from(keys.values()).find((k) => k.providerId === providerId && k.isActive);
    },

    setActiveKey(id) {
      const key = keys.get(id);
      if (!key) throw new Error(`Key "${id}" not found`);
      for (const k of keys.values()) {
        k.isActive = k.id === id;
      }
    },
  };
}
