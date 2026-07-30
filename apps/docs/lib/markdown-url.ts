import type { source } from "@/lib/source";
import { docsContentRoute } from "@/lib/shared";

type Page = (typeof source)["$inferPage"];

export function getPageMarkdownUrl(page: Page) {
  const segments = [...page.slugs, "content.md"];
  return {
    segments,
    url: `/${docsContentRoute.split("/").concat(segments).join("/")}`,
  };
}
