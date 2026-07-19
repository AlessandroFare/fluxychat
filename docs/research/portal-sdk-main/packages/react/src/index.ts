// The "use client" directive is injected into every dist chunk by the tsup banner
// (see tsup.config.ts) rather than written here, so it lands exactly once in output.

export { PortalProvider } from "./provider.js";
export { useChannel } from "./use-channel.js";
export { useInbox } from "./use-inbox.js";

// `Me` and `PortalProviderProps` stay internal aliases — present in the emitted types as
// local declarations, never on the export list.
export type {
  UseChannelParams,
  UseChannelResult,
  UseInboxResult,
} from "./types.js";

// Presence shapes, re-exported so consumers get them from the react entry point without also
// importing @portalsdk/core.
export type { AggregatePresence, DetailedPresence } from "@portalsdk/core";
