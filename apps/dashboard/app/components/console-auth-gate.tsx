"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { HOSTED_PATHS, isClerkClientConfigured } from "@/lib/hosted-product";

/** Redirects unauthenticated users to Clerk sign-in on console routes. */
export function ConsoleAuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const clerkOn = isClerkClientConfigured();

  useEffect(() => {
    if (!clerkOn || !isLoaded || isSignedIn) return;
    const returnTo = pathname && pathname !== "/" ? pathname : HOSTED_PATHS.console;
    const target = `${HOSTED_PATHS.signIn}?redirect_url=${encodeURIComponent(returnTo)}`;
    router.replace(target);
  }, [clerkOn, isLoaded, isSignedIn, pathname, router]);

  if (!clerkOn) return <>{children}</>;

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        <Loader2 className="size-6 animate-spin" aria-hidden />
        <span className="sr-only">Checking sign-in…</span>
      </div>
    );
  }

  return <>{children}</>;
}
