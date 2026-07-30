import { loader } from "fumadocs-core/source";
import { defineDocs } from "fumadocs-mdx/macro";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
import { statusBadgesPlugin } from "fumadocs-core/source/status-badges";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { renderMethodBadge } from "@/components/method-badge";
import { openapi } from "@/lib/openapi";
import z from "zod";

interface OpenAPINameContext {
  fromExtractedOperation(item: { path: string; method: string }): {
    operation: { operationId?: string };
  } | undefined;
}

interface OpenAPINameOutput {
  type: "operation" | "webhook" | string;
  item: { path?: string; name?: string; method: string };
}

const docs = defineDocs({
  docs: {
    compiler: "satteri",
    schema: pageSchema.extend({
      status: z.string().optional(),
    }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
    async: true,
    lastModified: true,
  },
  meta: {
    schema: metaSchema.extend({
      description: z.string().optional(),
    }),
  },
});

/** Slugify operation pages under a tag — avoids duplicated path segments (e.g. auth/auth/token). */
function openapiOperationSlug(
  this: OpenAPINameContext,
  output: OpenAPINameOutput,
) {
  if (output.type !== "operation") {
    if (output.type === "webhook" && output.item.name) {
      return `${output.item.name}-${output.item.method.toLowerCase()}`;
    }
    return "index";
  }

  if (!output.item.path) return "index";

  const extracted = this.fromExtractedOperation({
    path: output.item.path,
    method: output.item.method,
  });
  if (extracted?.operation.operationId) return extracted.operation.operationId;

  const parts = output.item.path.split("/").filter(Boolean);
  const tail = parts.slice(1).join("-") || parts[0] || "root";
  return `${tail}-${output.item.method.toLowerCase()}`;
}

export const source = loader(
  {
    docs: docs.toFumadocsSource(),
    openapi: await openapi.staticSource({
      baseDir: "api-reference/http",
      per: "operation",
      groupBy: "tag",
      name: openapiOperationSlug,
      meta: { folderStyle: "folder" },
    }),
  },
  {
    baseUrl: "/docs",
    plugins: [
      lucideIconsPlugin(),
      statusBadgesPlugin({ renderBadge: renderMethodBadge }),
      openapi.loaderPlugin(),
    ],
  },
);
