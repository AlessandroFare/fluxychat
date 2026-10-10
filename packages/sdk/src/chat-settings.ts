"use client";

import React from "react";

/** Ably Chat UI Kit `ChatSettings`. */
export interface FluxyChatSettings {
  allowMessageUpdatesOwn: boolean;
  allowMessageUpdatesAny: boolean;
  allowMessageDeletesOwn: boolean;
  allowMessageDeletesAny: boolean;
  allowMessageReactions: boolean;
}

export const DEFAULT_CHAT_SETTINGS: FluxyChatSettings = {
  allowMessageUpdatesOwn: true,
  allowMessageUpdatesAny: false,
  allowMessageDeletesOwn: true,
  allowMessageDeletesAny: false,
  allowMessageReactions: true,
};

export function mergeChatSettings(
  ...layers: Array<Partial<FluxyChatSettings> | undefined>
): FluxyChatSettings {
  return Object.assign({}, DEFAULT_CHAT_SETTINGS, ...layers.filter(Boolean));
}

export function getEffectiveChatSettings(
  roomName: string | undefined,
  globalSettings?: Partial<FluxyChatSettings>,
  roomSettings?: Record<string, Partial<FluxyChatSettings>>,
): FluxyChatSettings {
  const id = roomName?.trim();
  return mergeChatSettings(globalSettings, id ? roomSettings?.[id] : undefined);
}

export function canUpdateChatMessage(settings: FluxyChatSettings, isOwn: boolean): boolean {
  return isOwn ? settings.allowMessageUpdatesOwn : settings.allowMessageUpdatesAny;
}

export function canDeleteChatMessage(settings: FluxyChatSettings, isOwn: boolean): boolean {
  return isOwn ? settings.allowMessageDeletesOwn : settings.allowMessageDeletesAny;
}

export function canReactToChatMessage(settings: FluxyChatSettings): boolean {
  return settings.allowMessageReactions;
}

export interface FluxyChatSettingsContextValue {
  globalSettings: FluxyChatSettings;
  roomSettings: Record<string, Partial<FluxyChatSettings>>;
  getEffectiveSettings: (roomName?: string) => FluxyChatSettings;
}

const ChatSettingsContext = React.createContext<FluxyChatSettingsContextValue | null>(null);

export interface FluxyChatSettingsProviderProps {
  children?: React.ReactNode;
  initialGlobalSettings?: Partial<FluxyChatSettings>;
  initialRoomSettings?: Record<string, Partial<FluxyChatSettings>>;
}

/** Ably `ChatSettingsProvider`. */
export function FluxyChatSettingsProvider({
  children,
  initialGlobalSettings,
  initialRoomSettings,
}: FluxyChatSettingsProviderProps) {
  const globalSettings = React.useMemo(
    () => mergeChatSettings(initialGlobalSettings),
    [initialGlobalSettings],
  );
  const roomSettings = React.useMemo(
    () => initialRoomSettings ?? {},
    [initialRoomSettings],
  );
  const value = React.useMemo<FluxyChatSettingsContextValue>(
    () => ({
      globalSettings,
      roomSettings,
      getEffectiveSettings: (roomName) =>
        getEffectiveChatSettings(roomName, globalSettings, roomSettings),
    }),
    [globalSettings, roomSettings],
  );
  return React.createElement(ChatSettingsContext.Provider, { value }, children);
}

/** Ably `useChatSettings`. Works without a provider (defaults). */
export function useChatSettings() {
  const ctx = React.useContext(ChatSettingsContext);
  return (
    ctx ?? {
      globalSettings: DEFAULT_CHAT_SETTINGS,
      roomSettings: {},
      getEffectiveSettings: (roomName?: string) =>
        getEffectiveChatSettings(roomName, DEFAULT_CHAT_SETTINGS, {}),
    }
  );
}
