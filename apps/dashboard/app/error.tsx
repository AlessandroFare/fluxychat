"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { messageFromUnknown } from "@/lib/error-message";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { ConsoleShell } from "./components/console-shell";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(messageFromUnknown(error, "Route error"));
  }, [error]);

  return (
    <ConsoleShell className="flex min-h-[50vh] items-center justify-center">
      <div role="alert" className="flex max-w-md flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-muted">
          <TriangleAlert className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This screen hit an unexpected error. Nothing was lost — try again, or head back to the
          console.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            Error ref: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => retry()}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href={HOSTED_PATHS.console}>Console home</Link>
          </Button>
        </div>
      </div>
    </ConsoleShell>
  );
}
