import { createFluxyRoomStore, type FluxyRoomStore } from "./fluxy-room-store";

const stores = new Map<string, FluxyRoomStore>();

/** One Zustand store per room session key so `useChat` + `useThread` share the channel buffer. */
export function getSharedFluxyRoomStore(sessionKey: string): FluxyRoomStore {
  let store = stores.get(sessionKey);
  if (!store) {
    store = createFluxyRoomStore();
    stores.set(sessionKey, store);
  }
  return store;
}
