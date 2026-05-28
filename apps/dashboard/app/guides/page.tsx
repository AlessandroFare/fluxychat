import Link from "next/link";
import { ALL_GUIDES } from "@/lib/guides/related-guides";
import { DEVTO_SOCKET_FLEET_ARTICLE } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";
import { Button } from "~/components/ui/button";
import { HOSTED_PATHS } from "@/lib/hosted-product";

export const metadata = buildPageMetadata({
  title: "Guides — edge chat on Cloudflare",
  description:
    "Guides for durable objects chat, Vercel + Workers split, reconnect after DO hibernation, and DIY vs FluxyChat — cloudflare workers websocket without a VPS.",
  path: "/guides",
});

export default function GuidesIndexPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-sm text-muted-foreground">
        <Link href={HOSTED_PATHS.landing} className="text-brand hover:underline">
          ← Back to home
        </Link>
      </p>

      <h1 className="mt-6 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
        Guides
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
        Edge-native realtime chat: shared state coordination on Durable Objects,
        production SDK patterns, and avoiding a second socket vendor on Vercel.
      </p>

      <ul className="mt-10 space-y-4">
        {ALL_GUIDES.map((guide) => (
          <li key={guide.href}>
            <Link
              href={guide.href}
              className="block rounded-xl border border-border p-4 transition hover:border-primary/40 hover:bg-muted/30"
            >
              <span className="font-semibold text-foreground">{guide.label}</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {guide.href}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10 rounded-xl border border-primary/20 bg-primary/5 p-5">
        <p className="font-medium">Long-form walkthrough</p>
        <p className="mt-2 text-sm text-muted-foreground">
          <a
            href={DEVTO_SOCKET_FLEET_ARTICLE.href}
            target="_blank"
            rel="noreferrer"
            className="text-brand hover:underline"
          >
            {DEVTO_SOCKET_FLEET_ARTICLE.title}
          </a>
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href={HOSTED_PATHS.compare}>Compare approaches</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={HOSTED_PATHS.getStarted}>Get started</Link>
        </Button>
      </div>
    </div>
  );
}
