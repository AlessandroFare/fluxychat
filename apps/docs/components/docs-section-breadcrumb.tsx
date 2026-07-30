"use client";

import { cn } from "@/lib/cn";
import { useTreeContext, useTreePath } from "fumadocs-ui/contexts/tree";
import { getBreadcrumbItemsFromPath } from "fumadocs-core/breadcrumb";
import { useMemo } from "react";

interface DocsSectionBreadcrumbProps {
  className?: string;
}

/** Gray section label above the page title. */
export function DocsSectionBreadcrumb({
  className,
}: DocsSectionBreadcrumbProps) {
  const path = useTreePath();
  const { root } = useTreeContext();

  const label = useMemo(() => {
    const items = getBreadcrumbItemsFromPath(root, path, {
      includePage: false,
      includeRoot: false,
      includeSeparator: false,
    });
    return items.at(-1)?.name ?? null;
  }, [path, root]);

  if (!label) return null;

  return (
    <p
      className={cn(
        "text-[0.8125rem] font-normal text-fd-muted-foreground",
        className,
      )}
    >
      {label}
    </p>
  );
}
