import Link from "next/link";
import type { GuideContent, RelatedGuide } from "@/lib/guides/types";
import { DEVTO_SOCKET_FLEET_ARTICLE } from "@/lib/marketing-links";
import { Button } from "~/components/ui/button";
import { HOSTED_PATHS } from "@/lib/hosted-product";

interface MarketingGuidePageProps {
  content: GuideContent;
  path: string;
  relatedGuides?: readonly RelatedGuide[];
}

export function MarketingGuidePage({
  content,
  path,
  relatedGuides = [],
}: MarketingGuidePageProps) {
  const { title, subtitle, sections, seoTopics } = content;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-sm text-muted-foreground">
        <Link href="/guides" className="text-brand hover:underline">
          ← All guides
        </Link>
        {" · "}
        <Link href={HOSTED_PATHS.landing} className="text-brand hover:underline">
          Home
        </Link>
      </p>

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Guide
      </p>
      <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
        {subtitle}
      </p>

      <div className="mt-10 space-y-10">
        {sections.map((section) => (
          <section key={section.id ?? section.title} id={section.id}>
            <h2 className="font-heading text-xl font-semibold">{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p
                key={paragraph.slice(0, 48)}
                className="mt-3 text-sm leading-relaxed text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}
            {section.bullets ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {section.code ? (
              <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 text-xs leading-relaxed">
                <code>{section.code}</code>
              </pre>
            ) : null}
            {section.link ? (
              <p className="mt-3 text-sm">
                <a
                  href={section.link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-brand hover:underline"
                >
                  {section.link.title} →
                </a>
              </p>
            ) : null}
          </section>
        ))}
      </div>

      {relatedGuides.length > 0 ? (
        <nav className="mt-12 rounded-xl border border-border p-5">
          <p className="text-sm font-semibold">Related guides</p>
          <ul className="mt-3 space-y-2 text-sm">
            {relatedGuides.map((guide) => (
              <li key={guide.href}>
                <Link href={guide.href} className="text-brand hover:underline">
                  {guide.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <section className="mt-12 rounded-xl border border-border bg-muted/30 p-5">
        <h2 className="font-heading text-lg font-semibold">Production next step</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          FluxyChat packages the same stack: RoomDurableObject, D1 history, multi-tenant JWT,
          reconnect-aware SDK, and operator console. MIT self-host or hosted beta.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={HOSTED_PATHS.getStarted}>Get started</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={HOSTED_PATHS.compare}>Compare vendors</Link>
          </Button>
          <Button asChild variant="outline">
            <a href={DEVTO_SOCKET_FLEET_ARTICLE.href} target="_blank" rel="noreferrer">
              Dev.to walkthrough
            </a>
          </Button>
        </div>
      </section>

      <p className="mt-10 text-xs text-muted-foreground">
        Topics: {seoTopics.join(" · ")}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Canonical path: {path}
      </p>
    </div>
  );
}
