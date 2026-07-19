import { AIProviderRegistry, type AILanguageModel, type AIEmbeddingModel, type AIRerankModel } from "./providers";

export interface CustomProviderConfig {
  languageModels?: Record<string, AILanguageModel>;
  embeddingModels?: Record<string, AIEmbeddingModel>;
  rerankModels?: Record<string, AIRerankModel>;
  fallbackProvider?: AIProviderRegistry | AILanguageModel | (() => AILanguageModel);
}

export interface ProviderRegistryConfig {
  [providerId: string]: AIProviderRegistry | CustomProviderConfig | AILanguageModel | (() => AILanguageModel);
}

export interface ProviderRegistryOptions {
  separator?: string;
}

export class ProviderRegistry {
  private readonly registries = new Map<string, AIProviderRegistry>();
  private readonly separator: string;

  constructor(config: ProviderRegistryConfig, options?: ProviderRegistryOptions) {
    this.separator = options?.separator ?? ":";
    for (const [providerId, entry] of Object.entries(config)) {
      if (entry instanceof AIProviderRegistry) {
        this.registries.set(providerId, entry);
      } else if (typeof entry === "function" || (entry && typeof (entry as AILanguageModel).modelId === "string")) {
        const registry = new AIProviderRegistry();
        const model = typeof entry === "function" ? (entry as () => AILanguageModel)() : (entry as AILanguageModel);
        registry.register(model);
        this.registries.set(providerId, registry);
      } else {
        const custom = entry as CustomProviderConfig;
        const registry = new AIProviderRegistry();
        if (custom.languageModels) {
          for (const [, model] of Object.entries(custom.languageModels)) {
            registry.register(model);
          }
        }
        if (custom.embeddingModels) {
          for (const [, model] of Object.entries(custom.embeddingModels)) {
            registry.register(model);
          }
        }
        if (custom.rerankModels) {
          for (const [, model] of Object.entries(custom.rerankModels)) {
            registry.register(model);
          }
        }
        if (custom.fallbackProvider) {
          if (custom.fallbackProvider instanceof AIProviderRegistry) {
            for (const key of custom.fallbackProvider.list()) {
              try {
                registry.register(custom.fallbackProvider.resolve(key));
              } catch { /* skip duplicates */ }
            }
          } else {
            const fallback = typeof custom.fallbackProvider === "function"
              ? (custom.fallbackProvider as () => AILanguageModel)()
              : (custom.fallbackProvider as AILanguageModel);
            registry.register(fallback);
          }
        }
        this.registries.set(providerId, registry);
      }
    }
  }

  languageModel(reference: string): AILanguageModel {
    const parts = this.splitReference(reference);
    const registry = this.registries.get(parts.providerId);
    if (!registry) throw new Error(`Unknown provider: ${parts.providerId}`);
    const suffix = `:${parts.modelId}`;
    for (const [key, factory] of registry.models) {
      if (key.endsWith(suffix)) return factory() as AILanguageModel;
    }
    throw new Error(`Unknown model "${parts.modelId}" in provider "${parts.providerId}"`);
  }

  private splitReference(reference: string): { providerId: string; modelId: string } {
    const sepIdx = reference.indexOf(this.separator);
    if (sepIdx === -1) throw new Error(`Invalid model reference "${reference}": expected format "provider${this.separator}model"`);
    return {
      providerId: reference.slice(0, sepIdx),
      modelId: reference.slice(sepIdx + this.separator.length),
    };
  }

  hasProvider(providerId: string): boolean {
    return this.registries.has(providerId);
  }

  listProviders(): string[] {
    return [...this.registries.keys()].sort();
  }
}

export function createCustomProvider(config: CustomProviderConfig): AIProviderRegistry {
  const registry = new AIProviderRegistry();
  if (config.languageModels) {
    for (const [, model] of Object.entries(config.languageModels)) {
      registry.register(model);
    }
  }
  if (config.embeddingModels) {
    for (const [, model] of Object.entries(config.embeddingModels)) {
      registry.register(model);
    }
  }
  if (config.rerankModels) {
    for (const [, model] of Object.entries(config.rerankModels)) {
      registry.register(model);
    }
  }
  if (config.fallbackProvider) {
    if (config.fallbackProvider instanceof AIProviderRegistry) {
      for (const key of config.fallbackProvider.list()) {
        try { registry.register(config.fallbackProvider.resolve(key)); } catch { /* skip */ }
      }
    } else {
      const fallback = typeof config.fallbackProvider === "function"
        ? config.fallbackProvider()
        : config.fallbackProvider;
      registry.register(fallback);
    }
  }
  return registry;
}

export function createProviderRegistry(
  config: ProviderRegistryConfig,
  options?: ProviderRegistryOptions,
): ProviderRegistry {
  return new ProviderRegistry(config, options);
}
