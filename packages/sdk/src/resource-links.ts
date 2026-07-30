import { dynamicTool } from "./dynamic-tools";

export const RESOURCE_LINK_MIME_TYPE = "resource_link" as const;

export interface ResourceLinkContent {
  type: typeof RESOURCE_LINK_MIME_TYPE;
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface UriPolicy {
  allowedSchemes: string[];
  blockedDomains?: string[];
  maxRedirects?: number;
  allowCredentials?: boolean;
  maxContentLength?: number;
}

export interface LazyFetchResult {
  content: string;
  mimeType: string;
  fetchedAt: number;
  sizeBytes: number;
}

export type ResourceFetchMode = "inline" | "lazy" | "on_demand";

export interface ResourceLinkManager {
  createLink(params: Omit<ResourceLinkContent, "type">): ResourceLinkContent;
  validateUri(uri: string, policy?: UriPolicy): boolean;
  setUriPolicy(policy: UriPolicy): void;
  getUriPolicy(): UriPolicy;
  fetchResource(uri: string): Promise<LazyFetchResult>;
  getCache(): Map<string, LazyFetchResult>;
  clearCache(): void;
}

const DEFAULT_URI_POLICY: UriPolicy = {
  allowedSchemes: ["https", "http", "data"],
  maxRedirects: 5,
  allowCredentials: false,
  maxContentLength: 10 * 1024 * 1024,
};

export function createResourceLinkManager(policy?: Partial<UriPolicy>): ResourceLinkManager {
  let uriPolicy: UriPolicy = { ...DEFAULT_URI_POLICY, ...policy };
  const cache = new Map<string, LazyFetchResult>();

  return {
    createLink(params) {
      return { type: RESOURCE_LINK_MIME_TYPE, ...params };
    },

    validateUri(uri: string, policy?: UriPolicy) {
      const p = policy ?? uriPolicy;
      try {
        const url = new URL(uri);
        if (!p.allowedSchemes.includes(url.protocol.replace(":", ""))) return false;
        if (p.blockedDomains) {
          for (const domain of p.blockedDomains) {
            if (url.hostname === domain || url.hostname.endsWith(`.${domain}`)) return false;
          }
        }
        return true;
      } catch {
        return false;
      }
    },

    setUriPolicy(policy: UriPolicy) {
      uriPolicy = { ...policy };
    },

    getUriPolicy() {
      return { ...uriPolicy };
    },

    async fetchResource(uri: string) {
      if (!this.validateUri(uri)) throw new Error(`URI "${uri}" blocked by policy`);
      const cached = cache.get(uri);
      if (cached) return { ...cached };
      const result: LazyFetchResult = {
        content: `fetched content from ${uri}`,
        mimeType: "text/plain",
        fetchedAt: Date.now(),
        sizeBytes: uri.length,
      };
      cache.set(uri, result);
      return { ...result };
    },

    getCache() {
      return new Map(cache);
    },

    clearCache() {
      cache.clear();
    },
  };
}
