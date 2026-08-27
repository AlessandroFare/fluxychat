import Link from "next/link";
import { Check, Handshake, ShieldCheck, Vote } from "lucide-react";
import { MARKETING_ENTERPRISE } from "@/lib/marketing-landing";

const PILLARS = [
  {
    href: "/agents/cross-org",
    icon: Handshake,
    title: "Cross-org rooms",
    body: "Two companies, one room, private terms and settlement. Not a Cloudflare Agents class.",
  },
  {
    href: "/rooms",
    icon: Vote,
    title: "Critical-action quorum",
    body: "High-risk tools and decisions wait for a binding ack from the humans who own the room.",
  },
  {
    href: "/rooms",
    icon: ShieldCheck,
    title: "E2EE envelope + attestation",
    body: "Group cipher for the payload. Signed conversation export any auditor can verify offline.",
  },
] as const;

export function LandingEnterpriseSection() {
  return (
    <section className="border-b border-[var(--mkt-border)] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--mkt-brand)]">
          {MARKETING_ENTERPRISE.eyebrow}
        </p>
        <h2 className="mt-3 text-balance text-center font-heading text-3xl font-bold tracking-tight text-[var(--mkt-text)]">
          {MARKETING_ENTERPRISE.title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-center text-[var(--mkt-text-muted)]">
          {MARKETING_ENTERPRISE.intro}
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PILLARS.map((pillar) => (
            <Link
              key={pillar.title}
              href={pillar.href}
              className="rounded-2xl border border-[var(--mkt-border)] bg-[var(--mkt-surface)] p-5 no-underline transition hover:border-[var(--mkt-brand)]"
            >
              <pillar.icon className="size-5 text-[var(--mkt-brand)]" aria-hidden />
              <h3 className="mt-3 font-heading text-lg font-semibold text-[var(--mkt-text)]">{pillar.title}</h3>
              <p className="mt-2 text-sm text-[var(--mkt-text-muted)]">{pillar.body}</p>
            </Link>
          ))}
        </div>
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
          Walk the operator path in the{" "}
          <Link href="/agents/cross-org" className="font-medium text-primary underline-offset-2 hover:underline">
            cross-org console
          </Link>
          {", "}
          <Link href="/rooms" className="font-medium text-primary underline-offset-2 hover:underline">
            room insights
          </Link>
          {", and "}
          <Link
            href="https://docs.fluxychat.com/docs/guides/enterprise/default-story"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            enterprise default story
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
