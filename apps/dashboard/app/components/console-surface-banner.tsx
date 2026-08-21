"use client";

import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { getDashboardSurfaceKind } from "@/lib/dashboard-feature-flags";

export function ConsoleSurfaceBanner({ pathname }: { pathname: string | null }) {
  const kind = getDashboardSurfaceKind(pathname);
  if (kind === "ga") return null;

  const isLabs = kind === "labs";
  return (
    <div
      className={
        isLabs
          ? "border-b border-violet-200 bg-violet-50 px-4 py-2 text-xs text-violet-900"
          : "border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950"
      }
    >
      <FlaskConical className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom" aria-hidden />
      {isLabs ? (
        <>
          <strong>Labs.</strong> Experimental surface on the room kernel, not the GA operator path.{" "}
          <Link href="/labs" className="font-medium underline-offset-2 hover:underline">
            All labs
          </Link>
        </>
      ) : (
        <>
          <strong>Preview.</strong> Early tools (marketplace, agent platform, …). Expect rough edges.
        </>
      )}
    </div>
  );
}
