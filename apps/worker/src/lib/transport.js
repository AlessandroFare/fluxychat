/**
 * P24-4: Transport Architecture — Worker Implementation
 * Pluggable transport layer for LLM communication.
 */

/**
 * Create an HTTP transport using fetch.
 * @param {Object} config
 */
export function createHTTPTransport(config) {
  const { baseUrl, apiKey, headers = {}, timeoutMs = 60_000 } = config;

  return {
    type: "http",

    async send(request) {
      const url = `${baseUrl}${request.path}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const resp = await fetch(url, {
          method: request.method,
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            ...headers,
            ...request.headers,
          },
          body: request.body ? JSON.stringify(request.body) : undefined,
          signal: request.signal || controller.signal,
        });

        const body = await resp.json().catch(() => null);
        return {
          status: resp.status,
          headers: Object.fromEntries(resp.headers.entries()),
          body,
        };
      } finally {
        clearTimeout(timeout);
      }
    },

    async stream(request) {
      const url = `${baseUrl}${request.path}`;
      const resp = await fetch(url, {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          ...headers,
          ...request.headers,
        },
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: request.signal,
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      return {
        async *[Symbol.asyncIterator]() {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") return;
                try {
                  yield JSON.parse(data);
                } catch {
                  yield { data };
                }
              }
            }
          }
        },
      };
    },

    async healthCheck() {
      try {
        const resp = await fetch(baseUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
        return resp.ok;
      } catch {
        return false;
      }
    },

    async close() {
      // HTTP is stateless, nothing to close
    },
  };
}

/**
 * Create an SSE transport for streaming.
 * @param {Object} config
 */
export function createSSETransport(config) {
  return createHTTPTransport({ ...config, headers: { ...config.headers, Accept: "text/event-stream" } });
}

/**
 * Create a WebSocket transport.
 * @param {Object} config
 */
export function createWebSocketTransport(config) {
  const { baseUrl, apiKey, headers = {} } = config;
  let ws = null;
  let connected = false;

  return {
    type: "websocket",

    async send(request) {
      if (!connected) {
        const url = baseUrl.replace(/^http/, "ws");
        ws = new WebSocket(url);
        connected = true;
      }
      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        ws.send(JSON.stringify({ id, ...request }));
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.id === id) {
            resolve({ status: 200, headers: {}, body: data });
          }
        };
        ws.onerror = reject;
      });
    },

    async stream(request) {
      if (!connected) {
        const url = baseUrl.replace(/^http/, "ws");
        ws = new WebSocket(url);
        connected = true;
      }
      ws.send(JSON.stringify(request));
      return {
        async *[Symbol.asyncIterator]() {
          while (connected) {
            const msg = await new Promise((resolve) => {
              ws.onmessage = (event) => resolve(JSON.parse(event.data));
            });
            yield msg;
          }
        },
      };
    },

    async healthCheck() {
      return connected;
    },

    async close() {
      if (ws) {
        ws.close();
        connected = false;
      }
    },
  };
}

/**
 * Create a transport registry.
 */
export function createTransportRegistry() {
  const transports = new Map();
  let defaultName = null;

  return {
    register(name, transport) {
      transports.set(name, transport);
      if (!defaultName) defaultName = name;
    },

    get(name) {
      return transports.get(name) || null;
    },

    getDefault() {
      return defaultName ? transports.get(defaultName) : null;
    },

    setDefault(name) {
      if (transports.has(name)) defaultName = name;
    },

    list() {
      return Array.from(transports.entries()).map(([name, t]) => ({
        name,
        type: t.type,
        healthy: true,
      }));
    },
  };
}
