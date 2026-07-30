import Link from "next/link";
import { ALL_GUIDES } from "@/lib/guides/related-guides";
import { DEVTO_SOCKET_FLEET_ARTICLE } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";
import { Button } from "~/components/ui/button";
import { docsSiteHref, guideDocsHref, HOSTED_PATHS } from "@/lib/hosted-product";
import { ExternalLink } from "lucide-react";

export const metadata = buildPageMetadata({
  title: "Guides — edge chat on Cloudflare",
  description:
    "Guides for Workers chat, platform modules, Vercel + Cloudflare split, leaving Pusher, and in-app chat vs support desk.",
  path: "/guides",
});

export default function GuidesIndexPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-sm text-muted-foreground">
        <Link href={HOSTED_PATHS.landing} className="text-brand underline underline-offset-2">
          ← Back to home
        </Link>
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <h1 className="mt-6 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Guides
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Edge-native realtime: chat, AI agents, stream, collab, and IoT on one worker. Each topic
            below also lives on the{" "}
            <a
              href={docsSiteHref("learn")}
              className="text-brand underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              full docs site
            </a>{" "}
            with search and Ask AI. Try{" "}
            <Link href="/demo" className="text-brand underline underline-offset-2">
              /demo
            </Link>{" "}
            without signup.
          </p>
        </div>
        <div className="shrink-0 sm:pt-9">
          <Button asChild variant="outline">
            <a href={docsSiteHref("")} target="_blank" rel="noopener noreferrer">
              Docs site
              <ExternalLink className="ml-2 size-4" aria-hidden />
            </a>
          </Button>
        </div>
      </div>

      <ul className="mt-10 space-y-4">
        {ALL_GUIDES.map((guide) => (
          <li key={guide.href}>
            <div className="rounded-xl border border-border p-4 transition hover:border-primary/40 hover:bg-muted/30">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={guide.href} className="font-semibold text-foreground hover:text-primary">
                    {guide.label}
                  </Link>
                  <span className="mt-1 block text-sm text-muted-foreground">{guide.href}</span>
                </div>
                <a
                  href={guideDocsHref(guide.href)}
                  className="inline-flex items-center gap-1 text-sm text-brand underline underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  On docs site
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-10 rounded-xl border border-primary/20 bg-primary/5 p-5">
        <p className="font-medium">Long-form walkthrough</p>
        <p className="mt-2 text-sm text-muted-foreground">
          <a
            href={DEVTO_SOCKET_FLEET_ARTICLE.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand underline underline-offset-2"
          >
            {DEVTO_SOCKET_FLEET_ARTICLE.title}
          </a>
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <a href={docsSiteHref("getting-started/quickstart")} target="_blank" rel="noopener noreferrer">
            Quickstart on docs
          </a>
        </Button>
        <Button asChild variant="outline">
          <Link href={HOSTED_PATHS.compare}>Compare approaches</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={HOSTED_PATHS.getStarted}>Get started</Link>
        </Button>
      </div>
    </div>
  );
}
