export interface GuiSandboxConfig {
  allowedOrigins: string[];
  cspDirectives: Record<string, string[]>;
  capabilityGrants: string[];
  maxRenderTimeMs: number;
  maxMemoryMb: number;
  sandboxAttributes: string[];
}

export interface GuiComponent {
  componentId: string;
  source: string;
  sandboxConfig: GuiSandboxConfig;
  status: "pending" | "rendered" | "error" | "revoked";
}

export interface CapabilityGrant {
  grantId: string;
  componentId: string;
  capabilities: string[];
  expiresAt: string;
  revoked: boolean;
}

export interface GuiSandboxResult {
  componentId: string;
  iframeUrl: string;
  sandboxAttributes: string[];
  allowedCapabilities: string[];
  error?: string;
}

export interface GuiSandboxManager {
  registerComponent(componentId: string, source: string, config?: Partial<GuiSandboxConfig>): GuiComponent;
  renderComponent(componentId: string): GuiSandboxResult;
  grantCapability(componentId: string, capabilities: string[], ttlMs?: number): CapabilityGrant;
  revokeComponent(componentId: string): void;
  getComponent(componentId: string): GuiComponent | null;
  listComponents(): GuiComponent[];
}

const DEFAULT_CSP_DIRECTIVES: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "https:"],
  "connect-src": ["'self'"],
  "frame-ancestors": ["'self'"],
  "base-uri": ["'self'"],
};

const DEFAULT_SANDBOX_ATTRIBUTES = [
  "allow-scripts",
  "allow-same-origin",
  "allow-forms",
  "allow-popups",
];

export function createGuiSandboxManager(defaults: Partial<GuiSandboxConfig> = {}): GuiSandboxManager {
  const components = new Map<string, GuiComponent>();
  const grants = new Map<string, CapabilityGrant>();

  return {
    registerComponent(componentId: string, source: string, config: Partial<GuiSandboxConfig> = {}): GuiComponent {
      const sandboxConfig: GuiSandboxConfig = {
        allowedOrigins: config.allowedOrigins ?? defaults.allowedOrigins ?? ["self"],
        cspDirectives: { ...DEFAULT_CSP_DIRECTIVES, ...defaults.cspDirectives, ...config.cspDirectives },
        capabilityGrants: config.capabilityGrants ?? defaults.capabilityGrants ?? [],
        maxRenderTimeMs: config.maxRenderTimeMs ?? defaults.maxRenderTimeMs ?? 5000,
        maxMemoryMb: config.maxMemoryMb ?? defaults.maxMemoryMb ?? 50,
        sandboxAttributes: config.sandboxAttributes ?? defaults.sandboxAttributes ?? DEFAULT_SANDBOX_ATTRIBUTES,
      };
      const component: GuiComponent = { componentId, source, sandboxConfig, status: "pending" };
      components.set(componentId, component);
      return component;
    },

    renderComponent(componentId: string): GuiSandboxResult {
      const component = components.get(componentId);
      if (!component) return { componentId, iframeUrl: "", sandboxAttributes: [], allowedCapabilities: [], error: `Component ${componentId} not found` };

      component.status = "rendered";
      const iframeUrl = `sandbox://${componentId}`;

      return {
        componentId,
        iframeUrl,
        sandboxAttributes: component.sandboxConfig.sandboxAttributes,
        allowedCapabilities: component.sandboxConfig.capabilityGrants,
      };
    },

    grantCapability(componentId: string, capabilities: string[], ttlMs: number = 3600000): CapabilityGrant {
      const component = components.get(componentId);
      if (!component) throw new Error(`Component ${componentId} not found.`);

      const grant: CapabilityGrant = {
        grantId: `grant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        componentId,
        capabilities,
        expiresAt: new Date(Date.now() + ttlMs).toISOString(),
        revoked: false,
      };
      grants.set(grant.grantId, grant);
      return grant;
    },

    revokeComponent(componentId: string): void {
      const component = components.get(componentId);
      if (component) {
        component.status = "revoked";
      }
      for (const [grantId, grant] of grants) {
        if (grant.componentId === componentId) {
          grant.revoked = true;
        }
      }
    },

    getComponent(componentId: string) { return components.get(componentId) ?? null; },

    listComponents() { return [...components.values()]; },
  };
}
