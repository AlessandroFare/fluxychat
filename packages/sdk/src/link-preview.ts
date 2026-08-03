export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  favicon?: string;
  siteName?: string;
  aiSummary?: string | null;
}

export interface LinkPreviewApi {
  fetchMessage(url: string): Promise<LinkPreviewData | null>;
  extractLinks(text: string): string[];
}

export function createLinkPreview(): LinkPreviewApi {
  const cache = new Map<string, LinkPreviewData>();

  return {
    async fetchMessage(url) {
      const cached = cache.get(url);
      if (cached) return cached;

      const preview: LinkPreviewData = {
        url,
        title: url.replace(/https?:\/\//, "").split("/")[0],
      };
      cache.set(url, preview);
      return preview;
    },

    extractLinks(text) {
      const urlRe = /https?:\/\/[^\s<>"']+/g;
      return [...new Set(text.match(urlRe) ?? [])];
    },
  };
}

export function linkPreviewFromData(data: Partial<LinkPreviewData> & { url: string }): LinkPreviewData {
  return { url: data.url, title: data.title, description: data.description, imageUrl: data.imageUrl, favicon: data.favicon, siteName: data.siteName };
}
