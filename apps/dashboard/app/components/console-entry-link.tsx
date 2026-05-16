"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { consoleEntryHref } from "@/lib/hosted-product";

type ConsoleEntryLinkProps = Omit<ComponentProps<typeof Link>, "href">;

/** Console nav target: sign-in when Clerk is on, otherwise get-started (no naked `/`). */
export function ConsoleEntryLink({ children, ...props }: ConsoleEntryLinkProps) {
  return (
    <Link href={consoleEntryHref()} {...props}>
      {children}
    </Link>
  );
}
