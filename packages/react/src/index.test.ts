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
  useOccupancy,
  useTyping,
  useRoomReactions,
  useRoomStatus,
  useChatConnection,
  useChatClient,
  usePresence,
  useMessages,
  usePresenceListener,
  useLocks,
  useLock,
  useLocations,
  useCursors,
  useMembers,
  FluxyRoomProvider,
  useRoom,
  useSelf,
  useLeavers,
  FluxyChatSettingsProvider,
  useChatSettings,
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
    expect(typeof useOccupancy).toBe("function");
    expect(typeof useTyping).toBe("function");
    expect(typeof useRoomReactions).toBe("function");
    expect(typeof useRoomStatus).toBe("function");
    expect(typeof useChatConnection).toBe("function");
    expect(typeof useChatClient).toBe("function");
    expect(typeof usePresence).toBe("function");
    expect(typeof useMessages).toBe("function");
    expect(typeof usePresenceListener).toBe("function");
    expect(typeof useLocks).toBe("function");
    expect(typeof useLock).toBe("function");
    expect(typeof useLocations).toBe("function");
    expect(typeof useCursors).toBe("function");
    expect(typeof useMembers).toBe("function");
    expect(typeof FluxyRoomProvider).toBe("function");
    expect(typeof useRoom).toBe("function");
    expect(typeof useSelf).toBe("function");
    expect(typeof useLeavers).toBe("function");
    expect(typeof FluxyChatSettingsProvider).toBe("function");
    expect(typeof useChatSettings).toBe("function");
  });
});
