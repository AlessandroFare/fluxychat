import { createOpenAPI } from "fumadocs-openapi/server";
import path from "node:path";

const specPath = path.join(process.cwd(), "openapi.docs.yaml");

export const openapi = createOpenAPI({
  input: [specPath],
  proxyUrl: "/api/proxy",
});
