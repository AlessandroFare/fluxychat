import { describe, expect, it } from "vitest";
import {
  FluxyRealtimeProvider,
  useChat,
  useFluxyChat,
  useFluxyChatOptional,
  useInbox,
  useLocation,
  useNotifications,
  useThread,
  useUserChannel,
  useWebPush,
} from "./index";

describe("@fluxy-chat/react README exports", () => {
  it("exposes the documented hooks and provider", () => {
    expect(typeof FluxyRealtimeProvider).toBe("function");
    expect(typeof useChat).toBe("function");
    expect(typeof useThread).toBe("function");
    expect(typeof useInbox).toBe("function");
    expect(typeof useNotifications).toBe("function");
    expect(typeof useLocation).toBe("function");
    expect(typeof useWebPush).toBe("function");
    expect(typeof useUserChannel).toBe("function");
    expect(typeof useFluxyChat).toBe("function");
    expect(typeof useFluxyChatOptional).toBe("function");
  });
});
