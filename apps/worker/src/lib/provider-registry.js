/**
 * P25-13: Provider Registry
 * Formal provider/model management with createProviderRegistry.
 *
 * Manages AI providers and their models with a unified interface.
 * Supports dynamic registration, model lookup, and provider selection.
 *
 * Usage:
 *   const registry = createProviderRegistry();
 *   registry.register('openai', { apiKey: '...', models: ['gpt-4', 'gpt-3.5-turbo'] });
 *   registry.register('anthropic', { apiKey: '...', models: ['claude-3-opus', 'claude-3-sonnet'] });
 *
 *   const provider = registry.getProvider('openai');
 *   const model = registry.getModel('openai', 'gpt-4');
 *   const allModels = registry.getAllModels();
 */

// =============================================================================
// Provider Types
// =============================================================================

/**
 * @typedef {'openai' | 'anthropic' | 'google' | 'mistral' | 'cohere' | 'fireworks' | 'together' | 'deepseek' | 'xai' | 'custom'} ProviderId
 */

/**
 * @typedef {Object} ProviderConfig
 * @property {string} apiKey - API key
 * @property {string} [baseUrl] - Custom base URL
 * @property {string[]} [models] - Supported model IDs
 * @property {Record<string, any>} [headers] - Custom headers
 * @property {Record<string, any>} [config] - Provider-specific config
 */

/**
 * @typedef {Object} ModelInfo
 * @property {string} id - Model ID (e.g., 'gpt-4')
 * @property {ProviderId} provider - Provider ID
 * @property {string} [displayName] - Human-readable name
 * @property {number} [maxTokens] - Max output tokens
 * @property {number} [contextWindow] - Context window size
 * @property {boolean} [supportsStreaming] - Supports streaming
 * @property {boolean} [supportsTools] - Supports tool calling
 * @property {boolean} [supportsVision] - Supports image inputs
 * @property {number} [inputCostPer1k] - Cost per 1k input tokens
 * @property {number} [outputCostPer1k] - Cost per 1k output tokens
 */

/**
 * @typedef {Object} ProviderInfo
 * @property {ProviderId} id - Provider ID
 * @property {string} displayName - Human-readable name
 * @property {string} baseUrl - API base URL
 * @property {string[]} models - Supported model IDs
 * @property {Record<string, any>} [config] - Provider-specific config
 */

// =============================================================================
// Default Model Database
// =============================================================================

/** @type {Record<string, ModelInfo>} */
const DEFAULT_MODELS = {
  // OpenAI
  'gpt-4': {
    id: 'gpt-4',
    provider: 'openai',
    displayName: 'GPT-4',
    maxTokens: 4096,
    contextWindow: 8192,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
  },
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    provider: 'openai',
    displayName: 'GPT-4 Turbo',
    maxTokens: 4096,
    contextWindow: 128000,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
  },
  'gpt-4o': {
    id: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    maxTokens: 4096,
    contextWindow: 128000,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
  },
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    provider: 'openai',
    displayName: 'GPT-3.5 Turbo',
    maxTokens: 4096,
    contextWindow: 16385,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
  },
  // Anthropic
  'claude-3-opus': {
    id: 'claude-3-opus',
    provider: 'anthropic',
    displayName: 'Claude 3 Opus',
    maxTokens: 4096,
    contextWindow: 200000,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
  },
  'claude-3-sonnet': {
    id: 'claude-3-sonnet',
    provider: 'anthropic',
    displayName: 'Claude 3 Sonnet',
    maxTokens: 4096,
    contextWindow: 200000,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
  },
  'claude-3-haiku': {
    id: 'claude-3-haiku',
    provider: 'anthropic',
    displayName: 'Claude 3 Haiku',
    maxTokens: 4096,
    contextWindow: 200000,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
  },
  // Google
  'gemini-pro': {
    id: 'gemini-pro',
    provider: 'google',
    displayName: 'Gemini Pro',
    maxTokens: 8192,
    contextWindow: 32760,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
  },
  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    provider: 'google',
    displayName: 'Gemini 1.5 Pro',
    maxTokens: 8192,
    contextWindow: 1000000,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
  },
  // Mistral
  'mistral-large': {
    id: 'mistral-large',
    provider: 'mistral',
    displayName: 'Mistral Large',
    maxTokens: 4096,
    contextWindow: 32000,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
  },
  'mistral-medium': {
    id: 'mistral-medium',
    provider: 'mistral',
    displayName: 'Mistral Medium',
    maxTokens: 4096,
    contextWindow: 32000,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
  },
};

// =============================================================================
// Provider Registry
// =============================================================================

export class ProviderRegistry {
  constructor() {
    /** @type {Map<ProviderId, ProviderInfo>} */
    this.providers = new Map();
    /** @type {Map<string, ModelInfo>} */
    this.models = new Map(DEFAULT_MODELS);
  }

  /**
   * Register a provider.
   * @param {ProviderId} id
   * @param {ProviderConfig} config
   * @returns {ProviderInfo}
   */
  register(id, config) {
    const provider = {
      id,
      displayName: this.getDisplayName(id),
      baseUrl: config.baseUrl || this.getDefaultBaseUrl(id),
      models: config.models || [],
      config: config.config,
    };

    this.providers.set(id, provider);

    // Register models if provided
    if (config.models) {
      for (const modelId of config.models) {
        if (!this.models.has(modelId)) {
          this.models.set(modelId, {
            id: modelId,
            provider: id,
            displayName: this.getModelDisplayName(id, modelId),
          });
        }
      }
    }

    return provider;
  }

  /**
   * Get a provider by ID.
   * @param {ProviderId} id
   * @returns {ProviderInfo | undefined}
   */
  getProvider(id) {
    return this.providers.get(id);
  }

  /**
   * Get a model by provider and model ID.
   * @param {ProviderId} providerId
   * @param {string} modelId
   * @returns {ModelInfo | undefined}
   */
  getModel(providerId, modelId) {
    const model = this.models.get(modelId);
    if (model && model.provider === providerId) {
      return model;
    }
    // Try to find by provider prefix
    const prefixedModel = this.models.get(`${providerId}/${modelId}`);
    if (prefixedModel) {
      return prefixedModel;
    }
    return undefined;
  }

  /**
   * Get all models.
   * @returns {ModelInfo[]}
   */
  getAllModels() {
    return Array.from(this.models.values());
  }

  /**
   * Get all models for a provider.
   * @param {ProviderId} providerId
   * @returns {ModelInfo[]}
   */
  getModelsForProvider(providerId) {
    return this.getAllModels().filter((m) => m.provider === providerId);
  }

  /**
   * Find models by capability.
   * @param {keyof ModelInfo} capability
   * @returns {ModelInfo[]}
   */
  findModelsByCapability(capability) {
    return this.getAllModels().filter((m) => m[capability]);
  }

  /**
   * Get the best model for a task.
   * @param {{ requiresVision?: boolean, requiresTools?: boolean, maxContext?: number }} requirements
   * @returns {ModelInfo | null}
   */
  getBestModel(requirements = {}) {
    const candidates = this.getAllModels().filter((m) => {
      if (requirements.requiresVision && !m.supportsVision) return false;
      if (requirements.requiresTools && !m.supportsTools) return false;
      if (requirements.maxContext && m.contextWindow && m.contextWindow < requirements.maxContext) return false;
      return true;
    });

    // Sort by context window (larger first)
    candidates.sort((a, b) => (b.contextWindow || 0) - (a.contextWindow || 0));

    return candidates[0] || null;
  }

  /**
   * Get default base URL for a provider.
   * @param {ProviderId} id
   * @returns {string}
   */
  getDefaultBaseUrl(id) {
    const urls = {
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      google: 'https://generativelanguage.googleapis.com/v1',
      mistral: 'https://api.mistral.ai/v1',
      cohere: 'https://api.cohere.ai/v1',
      fireworks: 'https://api.fireworks.ai/inference/v1',
      together: 'https://api.together.xyz/v1',
      deepseek: 'https://api.deepseek.com/v1',
      xai: 'https://api.x.ai/v1',
      custom: '',
    };
    return urls[id] || '';
  }

  /**
   * Get display name for a provider.
   * @param {ProviderId} id
   * @returns {string}
   */
  getDisplayName(id) {
    const names = {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      google: 'Google',
      mistral: 'Mistral',
      cohere: 'Cohere',
      fireworks: 'Fireworks AI',
      together: 'Together AI',
      deepseek: 'DeepSeek',
      xai: 'xAI',
      custom: 'Custom',
    };
    return names[id] || id;
  }

  /**
   * Get display name for a model.
   * @param {ProviderId} providerId
   * @param {string} modelId
   * @returns {string}
   */
  getModelDisplayName(providerId, modelId) {
    const defaultModel = DEFAULT_MODELS[modelId];
    if (defaultModel) {
      return defaultModel.displayName;
    }
    return `${this.getDisplayName(providerId)} ${modelId}`;
  }

  /**
   * Export registry state.
   * @returns {{ providers: ProviderInfo[], models: ModelInfo[] }}
   */
  export() {
    return {
      providers: Array.from(this.providers.values()),
      models: Array.from(this.models.values()),
    };
  }

  /**
   * Import registry state.
   * @param {{ providers?: ProviderInfo[], models?: ModelInfo[] }} state
   */
  import(state) {
    if (state.providers) {
      for (const provider of state.providers) {
        this.providers.set(provider.id, provider);
      }
    }
    if (state.models) {
      for (const model of state.models) {
        this.models.set(model.id, model);
      }
    }
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a provider registry.
 * @returns {ProviderRegistry}
 */
export function createProviderRegistry() {
  return new ProviderRegistry();
}

/**
 * Create a provider registry with default providers.
 * @param {Record<ProviderId, ProviderConfig>} configs
 * @returns {ProviderRegistry}
 */
export function createConfiguredProviderRegistry(configs) {
  const registry = new ProviderRegistry();

  for (const [id, config] of Object.entries(configs)) {
    registry.register(id, config);
  }

  return registry;
}
