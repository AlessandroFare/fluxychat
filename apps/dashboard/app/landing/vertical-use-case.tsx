import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MarketingShell } from "../components/marketing-shell";
import { GetStartedAuthCta } from "../components/get-started-auth-cta";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { buildPageMetadata } from "@/lib/site-metadata";
import type { VerticalLandingPage } from "@/lib/vertical-landing";

export function verticalPageMetadata(page: VerticalLandingPage): Metadata {
  return buildPageMetadata({
    title: page.title,
    description: page.lede,
    path: `/${page.slug}`,
  });
}

export function VerticalUseCasePage({ page }: { page: VerticalLandingPage }) {
  return (
    <MarketingShell className="max-w-3xl pb-16">
      <Link
        href={HOSTED_PATHS.landing}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to home
      </Link>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{page.eyebrow}</p>
      <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">{page.title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{page.lede}</p>
      {page.sections.map((section) => (
        <section key={section.heading} className="mt-10">
          <h2 className="font-heading text-xl font-semibold">{section.heading}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{section.body}</p>
        </section>
      ))}
      <pre className="mt-10 overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-xs">
        <code>{page.scaffold}</code>
      </pre>
      <div className="mt-8 flex flex-wrap gap-3">
        <GetStartedAuthCta />
      </div>
    </MarketingShell>
  );
}
