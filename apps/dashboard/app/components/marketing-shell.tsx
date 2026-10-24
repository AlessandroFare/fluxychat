import { cn } from "@/lib/utils";
import { LandingFooter } from "../landing/landing-chrome";
import { LandingMotion } from "../landing/landing-motion";
import { cMono, cSans } from "../landing/c-fonts";
import styles from "../landing/landing-c.module.css";

/** Shared C shell for public marketing pages: tokens, footer, pointer, motion. */
export function MarketingShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${styles.root} ${styles.themeable} ${cSans.variable} ${cMono.variable}`}>
      <main className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", styles.page, className)}>
        {children}
      </main>
      <LandingFooter />
      <LandingMotion />
    </div>
  );
}
