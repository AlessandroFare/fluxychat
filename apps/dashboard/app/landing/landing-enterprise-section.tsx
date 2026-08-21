import Link from "next/link";
import { Check } from "lucide-react";
import { MARKETING_ENTERPRISE } from "@/lib/marketing-landing";

export function LandingEnterpriseSection() {
  return (
    <section className="border-b border-[var(--mkt-border)] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-balance text-center font-heading text-3xl font-bold tracking-tight text-[var(--mkt-text)]">
          {MARKETING_ENTERPRISE.title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-center text-[var(--mkt-text-muted)]">
          {MARKETING_ENTERPRISE.intro}
        </p>
        <ul className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MARKETING_ENTERPRISE.items.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 rounded-xl border border-[var(--mkt-border)] bg-[var(--mkt-surface)] px-4 py-3 text-sm text-[var(--mkt-text)]"
            >
              <Check className="size-4 shrink-0 text-[var(--mkt-brand)]" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
        <p className="mx-auto mt-8 max-w-xl text-pretty text-center text-sm text-[var(--mkt-text-muted)]">
          Explore capabilities in the{" "}
          <Link href="/features" className="font-medium text-primary underline-offset-2 hover:underline">
            features console
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
