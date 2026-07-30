import { createContext, useContext } from "react";

import type { Portal } from "@portalsdk/core";

/**
 * Holds the app's {@link Portal} instance. `null` until a {@link PortalProvider} supplies
 * one, which lets {@link usePortal} give a precise error when a hook is used outside the
 * provider rather than dereferencing `null`.
 */
export const PortalContext = createContext<Portal | null>(null);

/** Read the ambient {@link Portal}; throws if no {@link PortalProvider} is above in the tree. */
export function usePortal(): Portal {
  const portal = useContext(PortalContext);
  if (portal === null) {
    throw new Error(
      "No Portal client in context: wrap the tree in <PortalProvider client={…}> before " +
        "calling useChannel/useInbox.",
    );
  }
  return portal;
}
