import React from "react";
import type { Metadata } from "next";
import { ThemeProvider } from "./components/theme-provider";
import "./globals.css";
import ConditionalHeader from "./components/ConditionalHeader";
import { ClerkShell } from "./components/clerk-shell";
import { ClerkUserBridge } from "@/lib/clerk-user";
import { ConsoleChrome } from "./components/console-chrome";
import { DashboardSessionProvider } from "./components/dashboard-session";
import { ClerkSessionBinder } from "./components/clerk-session-binder";
import { FluxyAutoConnect } from "./components/fluxy-auto-connect";
import { FluxyRealtimeShell } from "./components/fluxy-realtime-shell";
import { BetaBanner } from "./components/beta-banner";
import { CookieConsentBanner } from "./components/cookie-consent-banner";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { ROOT_METADATA } from "@/lib/site-metadata";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  ...ROOT_METADATA,
  icons: {
    icon: "/fluxychat-icon.svg",
    apple: "/fluxychat-icon.svg",
  },
};

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shell = (
    <ClerkUserBridge>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light">
      <DashboardSessionProvider>
        {clerkPublishableKey ? (
          <>
            <ClerkSessionBinder />
            <FluxyAutoConnect />
          </>
        ) : null}
        <FluxyRealtimeShell>
          <BetaBanner />
          <ConditionalHeader />
          <main className="min-h-dvh bg-[#faf9f6] text-foreground antialiased">
            <ConsoleChrome>{children}</ConsoleChrome>
          </main>
          <CookieConsentBanner />
        </FluxyRealtimeShell>
      </DashboardSessionProvider>
    </ThemeProvider>
    </ClerkUserBridge>
  );

  const docsLlmsUrl =
    process.env.NEXT_PUBLIC_LLM_DOCS_URL?.trim() ||
    `${(process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://fluxychat.vercel.app").replace(/\/$/, "")}/docs/llms.txt`;

  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head>
        <link rel="llms" href={docsLlmsUrl} />
        <link rel="alternate" type="text/plain" href={docsLlmsUrl} title="LLM documentation index" />
      </head>
      <body>
        {clerkPublishableKey ? (
          <ClerkShell publishableKey={clerkPublishableKey}>{shell}</ClerkShell>
        ) : (
          shell
        )}
      </body>
    </html>
  );
}
