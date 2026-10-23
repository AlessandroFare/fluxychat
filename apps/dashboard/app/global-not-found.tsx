import Link from "next/link";
import "./globals.css";
import { cn } from "@/lib/utils";
import { buildPageMetadata } from "@/lib/site-metadata";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";
import { FluxychatLogotype } from "@/components/FluxychatLogo";
import { NotFoundContent } from "./components/not-found-content";
import { cMono, cSans } from "./landing/c-fonts";

/**
 * Unmatched URLs skip the app layout entirely (experimental.globalNotFound):
 * this keeps the 404 public — the root layout's console chrome would gate
 * anonymous visitors behind sign-in.
 */
export const metadata = buildPageMetadata({
  title: "Page not found",
  description:
    "This page does not exist on fluxychat.com. Open the console, read the docs, or head back to the homepage.",
  index: false,
});

export default function GlobalNotFound() {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("light font-sans", cSans.variable, cMono.variable)}
    >
      <head suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning className="bg-background text-foreground antialiased">
        <main className="fc-console flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-16">
          <Link href={HOSTED_PATHS.landing} aria-label="Fluxychat home">
            <FluxychatLogotype size={28} />
          </Link>
          <NotFoundContent />
        </main>
      </body>
    </html>
  );
}
