import { buildPageMetadata } from "@/lib/site-metadata";
import { ConsoleShell } from "./components/console-shell";
import { NotFoundContent } from "./components/not-found-content";

export const metadata = buildPageMetadata({
  title: "Page not found",
  description:
    "This page does not exist on fluxychat.com. Open the console, read the docs, or head back to the homepage.",
  index: false,
});

export default function NotFound() {
  return (
    <ConsoleShell className="flex min-h-[60vh] items-center justify-center">
      <NotFoundContent />
    </ConsoleShell>
  );
}
