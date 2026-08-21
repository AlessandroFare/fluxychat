"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlatformModule {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

interface LandingPlatformIndexProps {
  featured: readonly PlatformModule[];
  more: readonly PlatformModule[];
}

export function LandingPlatformIndex({ featured, more }: LandingPlatformIndexProps) {
  const [activeTitle, setActiveTitle] = useState(more[0]?.title ?? "");
  const active = more.find((item) => item.title === activeTitle) ?? more[0];

  return (
    <div className="mt-8 space-y-8">
      <ul className="grid gap-3 sm:grid-cols-2">
        {featured.map((item, index) => {
          const Icon = item.icon;
          return (
            <li key={item.title}>
              <Link
                href={item.href}
                className="group flex h-full flex-col justify-between rounded-2xl border border-[var(--mkt-border)] bg-[var(--mkt-surface)] p-5 transition hover:border-[var(--mkt-brand)]/35 sm:min-h-44 sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <Icon className="size-5 text-[var(--mkt-brand)]" aria-hidden />
                  <span className="font-mono text-xs text-[var(--mkt-text-muted)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="mt-8">
                  <h4 className="font-heading text-xl font-semibold text-[var(--mkt-text)]">{item.title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-text-muted)]">{item.description}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--mkt-brand)]">
                    Open
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {active ? (
        <div className="rounded-2xl border border-[var(--mkt-border)] bg-[var(--mkt-surface)] p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--mkt-text-muted)]">
            Also on the same worker
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5" role="list">
            {more.map((item) => {
              const selected = item.title === active.title;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setActiveTitle(item.title)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition",
                    selected
                      ? "bg-[var(--mkt-brand)] text-[#ffffff]"
                      : "bg-[var(--mkt-surface-2)] text-[var(--mkt-text)] hover:bg-[var(--mkt-border)]",
                  )}
                  aria-pressed={selected}
                >
                  {item.title}
                </button>
              );
            })}
          </div>
          <div className="mt-5 border-t border-[var(--mkt-border)] pt-4">
            <p className="font-heading text-lg font-semibold text-[var(--mkt-text)]">{active.title}</p>
            <p className="mt-1 max-w-2xl text-sm text-[var(--mkt-text-muted)]">{active.description}</p>
            <Link
              href={active.href}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--mkt-brand)]"
            >
              Try it <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
