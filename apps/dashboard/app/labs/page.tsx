"use client";

import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ReadinessBadge } from "~/components/ui/readiness-badge";
import {
  CONSOLE_NAV_INDUSTRIES,
  CONSOLE_NAV_PLATFORM,
} from "../components/console-nav";
import { DASHBOARD_LAB_HREFS } from "@/lib/dashboard-feature-flags";
import { listIndustryReadiness, listProductReadiness } from "@/lib/readiness-display";

const EXTRA_LABS = [
  { href: "/huddles", label: "Huddles", description: "Audio/video huddles" },
  { href: "/voice-ai", label: "Voice AI", description: "Realtime voice pipeline" },
  { href: "/cartography", label: "Cartography", description: "Thematic room map" },
  { href: "/truth-market", label: "Truth Market", description: "Stake and dispute claims" },
  { href: "/transport", label: "WebTransport", description: "Transport fallback chain" },
] as const;

export default function LabsCatalogPage() {
  const products = listProductReadiness().filter((e) => e.id !== "chat");
  const industries = listIndustryReadiness();

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Labs"
        icon={FlaskConical}
        description="Verticals and experiments on the same room kernel. APIs exist on the Worker; this is not the GA operator path (Projects → Rooms → Agents → Inbox)."
      />

      <p className="mb-6 text-sm text-muted-foreground">
        Pages stay reachable from this catalog. They are hidden from the main sidebar so the console stays oriented.
      </p>

      <section className="mb-8">
        <h2 className="mb-3 font-heading text-sm font-semibold text-foreground">Product labs</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {products.map((entry) => (
            <li key={entry.id}>
              <Link
                href={entry.href}
                className="block rounded-xl bg-card px-4 py-3 text-sm shadow-[var(--shadow-2)] transition hover:shadow-[var(--shadow-3)]"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{entry.label}</span>
                  <ReadinessBadge label={entry.readinessLabel} />
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{entry.description}</span>
              </Link>
            </li>
          ))}
          {CONSOLE_NAV_PLATFORM.filter(
            (item) =>
              DASHBOARD_LAB_HREFS.has(item.href) &&
              !products.some((p) => p.href === item.href || item.href.startsWith(`${p.href}/`)),
          ).map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-xl bg-card px-4 py-3 text-sm shadow-[var(--shadow-2)] transition hover:shadow-[var(--shadow-3)]"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{item.label}</span>
                  <ReadinessBadge label="Labs" />
                </span>
                {item.description ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-heading text-sm font-semibold text-foreground">Also in labs</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {EXTRA_LABS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-xl bg-card px-4 py-3 text-sm shadow-[var(--shadow-2)] transition hover:shadow-[var(--shadow-3)]"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{item.label}</span>
                  <ReadinessBadge label="Labs" />
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-sm font-semibold text-foreground">Industry studios</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {industries.map((entry) => (
            <li key={entry.id}>
              <Link
                href={entry.href}
                className="block rounded-xl bg-card px-4 py-3 text-sm shadow-[var(--shadow-2)] transition hover:shadow-[var(--shadow-3)]"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{entry.label}</span>
                  <ReadinessBadge label={entry.readinessLabel} />
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{entry.description}</span>
              </Link>
            </li>
          ))}
          {CONSOLE_NAV_INDUSTRIES.filter(
            (item) => !industries.some((p) => p.href === item.href),
          ).map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-xl bg-card px-4 py-3 text-sm shadow-[var(--shadow-2)] transition hover:shadow-[var(--shadow-3)]"
              >
                <span className="font-medium text-foreground">{item.label}</span>
                {item.description ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </ConsoleShell>
  );
}
