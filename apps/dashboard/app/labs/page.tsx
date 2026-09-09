"use client";

import Link from "next/link";
import { Layers } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ReadinessBadge } from "~/components/ui/readiness-badge";
import {
  CONSOLE_NAV_INDUSTRIES,
  CONSOLE_NAV_PLATFORM,
} from "../components/console-nav";
import { listIndustryReadiness, listProductReadiness } from "@/lib/readiness-display";

export default function PlatformCatalogPage() {
  const products = listProductReadiness().filter((e) => e.id !== "chat");
  const industries = listIndustryReadiness();
  const extraProducts = CONSOLE_NAV_PLATFORM.filter(
    (item) => !products.some((p) => p.href === item.href || item.href.startsWith(`${p.href}/`)),
  );
  const extraIndustries = CONSOLE_NAV_INDUSTRIES.filter(
    (item) => !industries.some((p) => p.href === item.href),
  );

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Platform"
        icon={Layers}
        description="Modules on the same room. Badges match PLATFORM_READINESS, not a GA claim."
      />

      <p className="mb-6 text-sm text-muted-foreground">
        Chat, collab, and invokeAgent are the kernel. The rest rides the same Worker. Hosted is open beta.
      </p>

      <section className="mb-8">
        <h2 className="mb-3 font-heading text-sm font-semibold text-foreground">Products</h2>
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
          {extraProducts.map((item) => (
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

      <section>
        <h2 className="mb-3 font-heading text-sm font-semibold text-foreground">Industries</h2>
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
          {extraIndustries.map((item) => (
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
    </ConsoleShell>
  );
}
