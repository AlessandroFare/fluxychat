"use client";

import { DocsCopyPageButton } from "@/components/docs-copy-page-button";
import { DocsSectionBreadcrumb } from "@/components/docs-section-breadcrumb";

interface DocsPageTopBarProps {
  markdownUrl: string;
  githubUrl?: string;
}

/** Gray section label on the left, unified Copy Page control on the right. */
export function DocsPageTopBar({
  markdownUrl,
  githubUrl,
}: DocsPageTopBarProps) {
  return (
    <div className="mb-1 flex items-center gap-4">
      <DocsSectionBreadcrumb className="min-w-0 flex-1" />
      <DocsCopyPageButton
        className="ms-auto shrink-0"
        markdownUrl={markdownUrl}
        githubUrl={githubUrl}
      />
    </div>
  );
}
