/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { FluxyRealtimeProvider } from "./realtime-provider";
import { useFluxyChat } from "./use-fluxy-chat";

function Probe() {
  const { ready, client, sessionScope } = useFluxyChat();
  return (
    <span
      data-ready={String(ready)}
      data-has-client={String(Boolean(client))}
      data-scope={sessionScope}
    />
  );
}

describe("FluxyRealtimeProvider publishableKey", () => {
  it("creates a client on first render without a member JWT", () => {
    const html = renderToString(
      <FluxyRealtimeProvider workerUrl="https://api.example.com" publishableKey="pk_test">
        <Probe />
      </FluxyRealtimeProvider>,
    );
    expect(html).toContain('data-ready="true"');
    expect(html).toContain('data-has-client="true"');
    expect(html).toContain('data-scope="app"');
  });

  it("stays unready when neither JWT nor pk_ is provided", () => {
    const html = renderToString(
      <FluxyRealtimeProvider workerUrl="https://api.example.com">
        <Probe />
      </FluxyRealtimeProvider>,
    );
    expect(html).toContain('data-ready="false"');
    expect(html).toContain('data-has-client="false"');
  });
});
