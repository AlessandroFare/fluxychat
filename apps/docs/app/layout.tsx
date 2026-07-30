import "./global.css";
import type { Viewport } from "next";
import { baseUrl, createMetadata } from "@/lib/metadata";
import { Provider } from "./provider";
import type { ReactNode } from "react";
import { Geist } from "next/font/google";
import { TreeContextProvider } from "fumadocs-ui/contexts/tree";
import { NextProvider } from "fumadocs-core/framework/next";
import { source } from "@/lib/source";
import { AskAiSidebar } from "@/components/ask-ai-sidebar";

export const metadata = createMetadata({
  title: {
    template: "%s | FluxyChat Docs",
    default: "FluxyChat Docs",
  },
  description: "Documentation for FluxyChat — realtime platform on Cloudflare.",
  metadataBase: baseUrl,
});

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#141414" },
    { media: "(prefers-color-scheme: light)", color: "#FF6A1A" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <body>
        <NextProvider>
          <TreeContextProvider tree={source.getPageTree()}>
            <Provider>
              {children}
              <AskAiSidebar />
            </Provider>
          </TreeContextProvider>
        </NextProvider>
      </body>
    </html>
  );
}
