const DOCS_LLMS =
  (process.env.NEXT_PUBLIC_DOCS_URL?.trim() || "https://docs.fluxychat.com").replace(/\/$/, "") +
  "/llms.txt";

export const revalidate = false;

export function GET() {
  return Response.redirect(DOCS_LLMS, 307);
}
