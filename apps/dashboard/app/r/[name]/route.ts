import { getShadcnRegistryIndex, getShadcnRegistryItem, SHADCN_REGISTRY_CORS } from "@/lib/shadcn-registry";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SHADCN_REGISTRY_CORS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...SHADCN_REGISTRY_CORS } });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params;
  if (name === "registry" || name === "registry.json") {
    return jsonResponse(getShadcnRegistryIndex());
  }
  const item = getShadcnRegistryItem(name);
  if (!item) return jsonResponse({ error: "not_found" }, 404);
  return jsonResponse(item);
}
