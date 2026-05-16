import Link from "next/link";
import { Button } from "~/components/ui/button";
import { HOSTED_PATHS } from "@/lib/hosted-product";

export function ClerkNotConfigured({ hint }: { hint?: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-950">
      <p className="font-medium">Clerk is not configured</p>
      <p className="mt-2 text-amber-900/90">
        Add <code className="rounded bg-white px-1 font-mono text-xs">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{" "}
        <code className="rounded bg-white px-1 font-mono text-xs">CLERK_SECRET_KEY</code> to{" "}
        <code className="rounded bg-white px-1 font-mono text-xs">apps/dashboard/.env.local</code>, then{" "}
        <strong>restart</strong> the dashboard dev server (<code className="font-mono text-xs">pnpm dev</code> in{" "}
        <code className="font-mono text-xs">apps/dashboard</code>).
      </p>
      {hint ? <p className="mt-2 text-xs text-amber-800/90">{hint}</p> : null}
      <Button asChild className="mt-4" variant="outline">
        <Link href={HOSTED_PATHS.getStarted}>Manual quickstart</Link>
      </Button>
    </div>
  );
}
