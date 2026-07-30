import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { source } from "@/lib/source";
import { baseOptions } from "@/lib/layout.shared";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...baseOptions()}
      containerProps={{
        className:
          "md:layout:[--fd-sidebar-width:268px] xl:layout:[--fd-toc-width:268px]",
      }}
      sidebar={{
        defaultOpenLevel: 0,
        collapsible: true,
      }}
    >
      {children}
    </DocsLayout>
  );
}
