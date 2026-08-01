import Link from "next/link";
import { Server } from "lucide-react";
import { HOSTED_PATHS } from "@/lib/hosted-product";

/** Advanced path — not the default funnel (hosted-first). */
export function GetStartedSelfHostSection() {
  return (
    <section
      id="self-host"
      className="mt-12 scroll-mt-24 rounded-2xl border border-dashed border-black/[0.12] bg-slate-50/80 p-5 sm:p-6"
    >
      <div className="flex gap-3">
        <Server className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden />
        <div>
          <h2 className="font-heading text-lg font-semibold text-slate-900">Self-host on Cloudflare (advanced)</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Deploy the Worker and D1 from the monorepo when you need your own Cloudflare account or an isolated tenant.
            Most teams start on hosted cloud and move here when compliance or scale asks for it.
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>Fork or clone the repo, deploy <code className="font-mono text-xs">apps/worker</code></li>
            <li>Set <code className="font-mono text-xs">NEXT_PUBLIC_FLUXYCHAT_WORKER_URL</code> in your app</li>
            <li>Mint JWTs with your project API key — see <code className="font-mono text-xs">docs/cookbook/auth-jwt.md</code></li>
          </ul>
          <p className="mt-4 flex flex-wrap gap-3">
            <a
              href="https://deploy.workers.cloudflare.com/?url=https://github.com/AlessandroFare/fluxychat/tree/main/apps/worker"
              className="inline-flex items-center rounded-lg bg-[#F6821F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e5741a]"
              target="_blank"
              rel="noopener noreferrer"
            >
              Deploy Worker to Cloudflare
            </a>
            <Link
              href="https://github.com/AlessandroFare/fluxychat/tree/main/apps/worker"
              className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/50"
              target="_blank"
              rel="noopener noreferrer"
            >
              Worker README on GitHub
            </Link>
            <Link href={HOSTED_PATHS.onboarding} className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/50">
              Manual setup wizard
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

