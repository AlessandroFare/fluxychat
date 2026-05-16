"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { ConsoleSidebar } from "./console-sidebar";
import { ConsoleMobileNav } from "./console-mobile-nav";
import { QuickstartGate } from "./quickstart-gate";
import { isConsoleRoute } from "./console-nav";

export function ConsoleChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (!isConsoleRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <Suspense fallback={null}>
      <QuickstartGate>
        <div className="flex min-h-[calc(100dvh-4rem)]">
          <ConsoleSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <ConsoleMobileNav />
            <div className="flex-1">{children}</div>
          </div>
        </div>
      </QuickstartGate>
    </Suspense>
  );
}
