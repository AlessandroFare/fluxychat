"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { ConsoleSidebar } from "./console-sidebar";
import { ConsoleMobileNav } from "./console-mobile-nav";
import { QuickstartGate } from "./quickstart-gate";
import { SystemStatusBanner } from "./system-status-banner";
import { ConsoleCommandPaletteProvider } from "./console-command-palette";
import { isConsoleRoute } from "./console-nav";

export function ConsoleChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (!isConsoleRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <Suspense fallback={null}>
      <ConsoleCommandPaletteProvider>
        <QuickstartGate>
          <SystemStatusBanner />
          <div className="flex min-h-[calc(100dvh-4rem)]">
            <ConsoleSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <ConsoleMobileNav />
              {/* Skip link for keyboard/mobile users: visually hidden until
                  focused, then jumps focus past the sidebar+nav to the main
                  content. (Audit UX fix.) */}
              <a
                href="#console-main"
                className="sr-only z-50 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
              >
                Skip to content
              </a>
              <main id="console-main" className="flex-1">{children}</main>
            </div>
          </div>
        </QuickstartGate>
      </ConsoleCommandPaletteProvider>
    </Suspense>
  );
}
