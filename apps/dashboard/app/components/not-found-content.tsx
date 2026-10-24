import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HOSTED_PATHS } from "@/lib/hosted-product";

/** Shared 404 body: app/not-found.tsx (in-app) and app/global-not-found.tsx (unmatched URLs). */
export function NotFoundContent() {
  return (
    <div className="flex max-w-md flex-col items-center text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-sm border border-border bg-surface-muted">
        <Compass className="h-6 w-6 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="font-heading text-[clamp(2rem,4vw,3rem)] font-normal leading-[1.02] tracking-[-0.03em] text-foreground">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The link may be outdated, or the address was mistyped. The fastest ways back:
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link href={HOSTED_PATHS.console}>Open console</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={HOSTED_PATHS.docs}>View docs</Link>
        </Button>
      </div>
      <Link
        href={HOSTED_PATHS.landing}
        className="mt-4 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Go to the FluxyChat homepage
      </Link>
    </div>
  );
}
