import { describe, expect, it } from "vitest";
import {
  FluxyRealtimeProvider,
  useChat,
  useFluxyChat,
  useInbox,
} from "./index";

describe("@fluxy-chat/react re-exports", () => {
  it("exposes provider and core hooks", () => {
    expect(typeof FluxyRealtimeProvider).toBe("function");
    expect(typeof useChat).toBe("function");
    expect(typeof useFluxyChat).toBe("function");
    expect(typeof useInbox).toBe("function");
  });
});
