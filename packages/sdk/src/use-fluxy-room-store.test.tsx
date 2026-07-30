/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createFluxyRoomStore } from "./fluxy-room-store";
import { useFluxyRoomStoreState } from "./use-fluxy-room-store";

function SnapshotProbe({ store }: { store: ReturnType<typeof createFluxyRoomStore> }) {
  const state = useFluxyRoomStoreState(store);
  return <span data-connected={String(state.connected)}>{state.connectionStatus}</span>;
}

describe("useFluxyRoomStoreState SSR", () => {
  it("renders inert snapshot on the server without throwing", () => {
    const store = createFluxyRoomStore();
    const html = renderToString(<SnapshotProbe store={store} />);
    expect(html).toContain('data-connected="false"');
    expect(html).toContain("idle");
  });
});
