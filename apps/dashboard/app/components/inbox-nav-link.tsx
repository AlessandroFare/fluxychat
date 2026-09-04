"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox } from "lucide-react";
import { useInbox, useFluxyChatOptional } from "@fluxy-chat/react";
import { isConsoleNavItemActive, consoleNavIconClass, consoleNavLinkClass } from "./console-nav";

/** Inbox nav link with unread-room counter badge (PL-6). */
export function InboxNavLink() {
  const pathname = usePathname();
  const realtime = useFluxyChatOptional();
  const { counter } = useInbox({
    client: realtime?.client ?? null,
    enabled: Boolean(realtime?.client?.isAuthenticated?.() ?? realtime?.client),
    pollIntervalMs: 60_000,
  });

  const isActive = isConsoleNavItemActive("/inbox", pathname);
  const showBadge = counter > 0;

  return (
    <Link href="/inbox" className={consoleNavLinkClass(isActive)}>
      <Inbox className={consoleNavIconClass(isActive)} aria-hidden />
      <span className="min-w-0 flex-1">Inbox</span>
      {showBadge ? (
        <span
          className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground"
          aria-label={`${counter} unread room${counter === 1 ? "" : "s"}`}
          data-testid="inbox-nav-badge"
        >
          {counter > 99 ? "99+" : counter}
        </span>
      ) : null}
    </Link>
  );
}
