import Link from "next/link";
import { FluxychatIcon } from "@/components/FluxychatLogo";
import { DEVTO_SOCKET_FLEET_ARTICLE } from "@/lib/marketing-links";
import { ConsoleEntryLink } from "../components/console-entry-link";
import { HOSTED_COPY, HOSTED_PATHS } from "@/lib/hosted-product";
import { LANDING_BADGES } from "./landing-shared";

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-[#111111] px-4 py-12 text-slate-300 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:gap-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-white">
            <FluxychatIcon size={28} />
            <span className="font-heading text-sm font-semibold">Fluxychat</span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-6 text-sm">
            <ConsoleEntryLink className="hover:text-white">{HOSTED_COPY.console}</ConsoleEntryLink>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
            <Link href={HOSTED_PATHS.why} className="hover:text-white">Why</Link>
            <Link href={HOSTED_PATHS.compare} className="hover:text-white">Compare</Link>
            <Link href={HOSTED_PATHS.guides} className="hover:text-white">Guides</Link>
            <Link href={HOSTED_PATHS.status} className="hover:text-white">Status</Link>
            <a
              href={DEVTO_SOCKET_FLEET_ARTICLE.href}
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              Dev.to
            </a>
            <a href="mailto:fluxychat@outlook.com" className="underline underline-offset-2 hover:text-white">
              fluxychat@outlook.com
            </a>
            <a
              href="https://github.com/AlessandroFare/fluxychat"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              GitHub
            </a>
          </nav>
          <p className="text-xs">© {year} Fluxychat</p>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-slate-300">Approved listings help teams trust the docs and demo.</p>
          <div className="flex flex-wrap items-center gap-3">
            {LANDING_BADGES.map((badge) => (
              <a
                key={`footer-${badge.id}`}
                href={badge.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
              >
                <img
                  src={badge.imgSrc}
                  alt={badge.alt}
                  width={badge.width}
                  height={badge.height}
                  loading="lazy"
                  className="h-8 w-auto"
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
