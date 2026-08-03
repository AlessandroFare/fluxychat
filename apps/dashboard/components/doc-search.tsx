"use client";

import dynamic from "next/dynamic";
import { LocalGuideSearch } from "@/components/local-guide-search";

const DocSearchConfig = {
  appId: process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || "",
  apiKey: process.env.NEXT_PUBLIC_ALGOLIA_API_KEY || "",
  indexName: process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME || "fluxychat",
};

const algoliaEnabled = Boolean(DocSearchConfig.appId && DocSearchConfig.apiKey);

const DocSearchAlgolia = dynamic(
  () =>
    import("@docsearch/react").then((mod) => {
      const Component = mod.DocSearch;
      return Component;
    }),
  { ssr: false },
);

interface DocsSearchProps {
  variant?: "dark" | "light";
  className?: string;
}

export function DocsSearch({ variant = "dark", className }: DocsSearchProps) {
  const isDark = variant === "dark";

  if (algoliaEnabled) {
    return (
      <div
        className={
          isDark
            ? "relative w-full max-w-md [&_.DocSearch-Button]:!w-full [&_.DocSearch-Button]:!rounded-xl [&_.DocSearch-Button]:!border [&_.DocSearch-Button]:!border-white/10 [&_.DocSearch-Button]:!bg-white/5 [&_.DocSearch-Button]:!h-10 [&_.DocSearch-Button]:!text-sm [&_.DocSearch-Button]:!text-slate-400 [&_.DocSearch-Button]:!shadow-none [&_.DocSearch-Button]:!gap-2 [&_.DocSearch-Button]:!px-4 [&_.DocSearch-Button:hover]:!bg-white/10 [&_.DocSearch-Button-Placeholder]:!text-slate-500 [&_.DocSearch-Search-Icon]:!text-slate-400 [&_.DocSearch-Button-Keys]:!hidden"
            : "relative w-full max-w-md [&_.DocSearch-Button]:!w-full [&_.DocSearch-Button]:!rounded-xl [&_.DocSearch-Button]:!border [&_.DocSearch-Button]:!border-border [&_.DocSearch-Button]:!bg-background [&_.DocSearch-Button]:!h-10 [&_.DocSearch-Button]:!text-sm [&_.DocSearch-Button]:!shadow-none [&_.DocSearch-Button]:!gap-2 [&_.DocSearch-Button]:!px-4"
        }
      >
        <DocSearchAlgolia
          appId={DocSearchConfig.appId}
          apiKey={DocSearchConfig.apiKey}
          indexName={DocSearchConfig.indexName}
        />
      </div>
    );
  }

  return <LocalGuideSearch variant={variant} className={className} />;
}

/** @deprecated Use DocsSearch */
export function DocSearchButton(props: DocsSearchProps) {
  return <DocsSearch {...props} />;
}
