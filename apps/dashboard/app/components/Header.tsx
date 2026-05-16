"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FluxychatLogotype } from "@/components/FluxychatLogo";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { isConsoleRoute } from "./console-nav";
import { HeaderAuth } from "./header-auth";

export default function Header() {
  const pathname = usePathname();
  const inConsole = isConsoleRoute(pathname);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-black/[0.06] bg-white/90 shadow-[var(--shadow-subtle-2)] backdrop-blur-md supports-[backdrop-filter]:bg-white/85">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        {inConsole ? (
          <div className="flex-1" aria-hidden />
        ) : (
          <Link
            href="/"
            className="shrink-0 text-slate-900 transition-opacity hover:opacity-80"
            aria-label="Fluxychat home"
          >
            <FluxychatLogotype size={28} />
          </Link>
        )}

        {!inConsole ? (
          <nav className="hidden items-center gap-6 md:flex" aria-label="Top links">
            <Link
              href="/landing"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Product
            </Link>
            <Link
              href="/get-started"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Get started
            </Link>
            <Link
              href={HOSTED_PATHS.docs}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Docs
            </Link>
          </nav>
        ) : null}

        <HeaderAuth />
      </div>
    </header>
  );
}
