import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { MarketingShell } from "../components/marketing-shell";
import { GetStartedAuthCta } from "../components/get-started-auth-cta";
import { HOSTED_COPY, HOSTED_PATHS } from "@/lib/hosted-product";
import { PAGE_METADATA } from "@/lib/marketing-copy";
import { WHY_CTA, WHY_FAQ, WHY_SECTIONS, WHY_THESIS } from "@/lib/why-copy";

export const metadata: Metadata = PAGE_METADATA.why;

export default function WhyPage() {
  return (
    <MarketingShell className="pb-16">
      <Link
        href={HOSTED_PATHS.landing}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to home
      </Link>

      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Why Fluxychat</p>
      <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        Why I built Fluxychat
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-slate-600">{WHY_THESIS}</p>

      <div className="mt-10 space-y-12">
        {WHY_SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <h2 className="font-heading text-xl font-semibold text-slate-900 sm:text-2xl">{section.title}</h2>
            {"paragraphs" in section && section.paragraphs ? (
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                {section.paragraphs.map((p) => (
                  <p key={p.slice(0, 48)}>{p}</p>
                ))}
              </div>
            ) : null}
            {section.bullets ? (
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600 sm:text-base">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      <section className="mt-14">
        <h2 className="font-heading text-xl font-semibold text-slate-900">Common questions</h2>
        <div className="mt-4 space-y-3">
          {WHY_FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-black/[0.06] bg-white/90 px-4 py-3 shadow-[var(--shadow-subtle-2)] open:shadow-md"
            >
              <summary className="cursor-pointer list-none font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  {item.q}
                  <span className="text-muted-foreground transition group-open:rotate-180">▾</span>
                </span>
              </summary>
              <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <div className="mt-14 flex flex-col gap-4 rounded-2xl border border-black/[0.06] bg-white/90 p-6 shadow-[var(--shadow-subtle-2)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-heading text-lg font-semibold text-slate-900">{WHY_CTA.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{WHY_CTA.body}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <GetStartedAuthCta />
          <Button asChild variant="outline">
            <Link href={HOSTED_PATHS.docs}>
              {HOSTED_COPY.viewDocs}
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a href="https://github.com/AlessandroFare/fluxychat" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </Button>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Questions or feedback:{" "}
        <a href="mailto:fluxychat@outlook.com" className="text-primary underline-offset-2 hover:underline">
          fluxychat@outlook.com
        </a>
      </p>
    </MarketingShell>
  );
}
