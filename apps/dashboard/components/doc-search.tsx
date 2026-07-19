"use client";

import dynamic from "next/dynamic";
import { Search } from "lucide-react";

const DocSearchConfig = {
  appId: process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || "",
  apiKey: process.env.NEXT_PUBLIC_ALGOLIA_API_KEY || "",
  indexName: process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME || "fluxychat",
};

const enabled = Boolean(DocSearchConfig.appId && DocSearchConfig.apiKey);

const DocSearchAlgolia = dynamic(
  () =>
    import("@docsearch/react").then((mod) => {
      const Component = mod.DocSearch;
      return Component;
    }),
  { ssr: false },
);

export function DocSearchButton() {
  if (enabled) {
    return (
      <div className="relative w-full max-w-md [&_.DocSearch-Button]:!w-full [&_.DocSearch-Button]:!rounded-xl [&_.DocSearch-Button]:!border [&_.DocSearch-Button]:!border-white/10 [&_.DocSearch-Button]:!bg-white/5 [&_.DocSearch-Button]:!h-10 [&_.DocSearch-Button]:!text-sm [&_.DocSearch-Button]:!text-slate-400 [&_.DocSearch-Button]:!shadow-none [&_.DocSearch-Button]:!gap-2 [&_.DocSearch-Button]:!px-4 [&_.DocSearch-Button:hover]:!bg-white/10 [&_.DocSearch-Button-Placeholder]:!text-slate-500 [&_.DocSearch-Search-Icon]:!text-slate-400 [&_.DocSearch-Button-Keys]:!hidden">
        <DocSearchAlgolia
          appId={DocSearchConfig.appId}
          apiKey={DocSearchConfig.apiKey}
          indexName={DocSearchConfig.indexName}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        readOnly
        placeholder="Search docs…"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-10 py-2.5 text-sm text-slate-300 placeholder:text-slate-500 outline-none"
        onClick={() => window.open("https://github.com/AlessandroFare/fluxychat", "_blank")}
      />
    </div>
  );
}
