import { readFile } from "node:fs/promises";
import path from "node:path";

export const revalidate = false;

export async function GET() {
  const specPath = path.join(process.cwd(), "openapi.docs.yaml");
  const yaml = await readFile(specPath, "utf8");

  return new Response(yaml, {
    headers: {
      "Content-Type": "application/yaml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, immutable",
    },
  });
}
