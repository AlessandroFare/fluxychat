"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FluxychatLogotype, FluxychatMark } from "@/components/FluxychatLogo";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { cn } from "@/lib/utils";
import { isConsoleRoute } from "./console-nav";
import { HeaderAuth } from "./header-auth";
import { ThemeToggle } from "~/components/ui/ThemeToggle";

export default function Header() {
  const pathname = usePathname();
  const inConsole = isConsoleRoute(pathname);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-border",
        inConsole ? "bg-background/95 backdrop-blur" : "bg-background",
      )}
    >
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        {inConsole ? (
          <>
            <Link
              href={HOSTED_PATHS.console}
              className="inline-flex items-center gap-2 text-foreground lg:hidden"
              aria-label="Fluxychat console home"
            >
              <FluxychatMark size={18} />
              <span className="font-mono text-[11px] uppercase tracking-[0.1em]">Console</span>
            </Link>
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground lg:inline">
              Console
            </span>
          </>
        ) : (
          <Link
            href={HOSTED_PATHS.landing}
            className="shrink-0 text-foreground transition-opacity hover:opacity-80"
            aria-label="Fluxychat home"
          >
            <FluxychatLogotype size={28} />
          </Link>
        )}

        {!inConsole ? (
          <nav className="hidden items-center gap-6 md:flex" aria-label="Top links">
            <Link
              href={HOSTED_PATHS.landing}
              className="text-sm font-normal text-muted-foreground transition-colors hover:text-foreground"
            >
              Product
            </Link>
            <Link
              href="/get-started"
              className="text-sm font-normal text-muted-foreground transition-colors hover:text-foreground"
            >
              Get started
            </Link>
            <Link
              href={HOSTED_PATHS.docs}
              className="text-sm font-normal text-muted-foreground transition-colors hover:text-foreground"
            >
              Docs
            </Link>
          </nav>
        ) : null}

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <HeaderAuth />
        </div>
      </div>
    </header>
  );
}
