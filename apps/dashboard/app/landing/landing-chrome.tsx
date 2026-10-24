"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, Moon, Sun, X } from "lucide-react";
import { FluxychatMark } from "@/components/FluxychatLogo";
import { useTheme } from "@/app/components/theme-provider";
import { HOSTED_PATHS, docsHomeHref } from "@/lib/hosted-product";
import { cMono, cSans } from "./c-fonts";
import styles from "./landing-c.module.css";

const NAV_LINKS = [
  { href: "/demo", label: "Demo room" },
  { href: "/#rooms", label: "Rooms" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/compare", label: "Compare" },
  { href: "/labs", label: "Labs" },
  { href: docsHomeHref(), label: "Docs" },
] as const;

function ChromeThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={() =>
        setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")
      }
      aria-label="Toggle light or dark theme"
    >
      <Moon className={styles.iconMoon} aria-hidden="true" />
      <Sun className={styles.iconSun} aria-hidden="true" />
    </button>
  );
}

export function LandingHeader({
  startHref,
  accountHref,
  themeToggle = false,
}: {
  startHref: string;
  accountHref: string;
  themeToggle?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const navLinks = NAV_LINKS.map((link) =>
    link.label === "Pricing" && pathname !== "/" ? { ...link, href: "/pricing" } : link,
  );

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header
      className={`${styles.chrome} ${themeToggle ? styles.themeable : ""} ${styles.bar} ${cSans.variable} ${cMono.variable}`}
    >
      <div ref={barRef} className={styles.barInner}>
        <Link href={HOSTED_PATHS.landing} className={styles.mark} aria-label="FluxyChat home">
          <FluxychatMark size={18} />
          <span>FluxyChat</span>
        </Link>

        <nav className={styles.nav} aria-label="Primary">
          {navLinks.map((link) =>
            link.href.startsWith("http") ? (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <div className={styles.navCta}>
          {themeToggle ? <ChromeThemeToggle /> : null}
          <Link href={accountHref} className={styles.account}>
            <span className={styles.accountDot} aria-hidden="true" />
            Account
            <ArrowUpRight className={styles.accountArrow} aria-hidden="true" />
          </Link>
          <Link href={startHref} className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}>
            Start free
          </Link>
          <button
            type="button"
            className={styles.menuButton}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>

        {open ? (
          <div className={styles.menuPanel} id="landing-mobile-menu">
            {navLinks.map((link) =>
              link.href.startsWith("http") ? (
                <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                  {link.label}
                </Link>
              ),
            )}
            <Link href={startHref} onClick={() => setOpen(false)} className={styles.menuStart}>
              Start free
            </Link>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function FooterWord({ text, className }: { text: string; className: string }) {
  return (
    <span className={`${styles.footerWord} ${className}`}>
      {Array.from(text).map((letter, index) => (
        <span
          key={index}
          className={styles.footerLetter}
          style={{ "--i": index } as CSSProperties}
        >
          {letter === " " ? "\u00A0" : letter}
        </span>
      ))}
    </span>
  );
}

export function LandingFooter() {
  const pathname = usePathname();
  const year = new Date().getFullYear();

  return (
    <div className={`${styles.chrome} ${pathname === "/" ? "" : styles.themeable} ${cSans.variable} ${cMono.variable}`}>
      <div className={styles.footerWords} aria-hidden="true">
        <FooterWord text="One room." className={styles.footerWordLeft} />
        <FooterWord text="One machine." className={styles.footerWordRight} />
      </div>
      <footer className={styles.footer}>
      <div className={`${styles.wrap} ${styles.footerGrid}`}>
        <div className={styles.footerBrand}>
          <span className={styles.mark}>
            <FluxychatMark size={18} />
            <span>FluxyChat</span>
          </span>
          <p>
            A room layer for in-app chat. One Durable Object per room, humans and agents on the
            same WebSocket. Self-host MIT or hosted beta.
          </p>
        </div>
        <div className={styles.footerCol}>
          <h3>Product</h3>
          <ul>
            <li>
              <Link href="/features">Features</Link>
            </li>
            <li>
              <Link href="/#rooms">Rooms</Link>
            </li>
            <li>
              <Link href="/pricing">Pricing</Link>
            </li>
            <li>
              <Link href="/demo">Playground</Link>
            </li>
            <li>
              <Link href={HOSTED_PATHS.compare}>Compare</Link>
            </li>
            <li>
              <Link href={HOSTED_PATHS.why}>Why</Link>
            </li>
          </ul>
        </div>
        <div className={styles.footerCol}>
          <h3>Developers</h3>
          <ul>
            <li>
              <a href={docsHomeHref()}>Docs</a>
            </li>
            <li>
              <Link href={HOSTED_PATHS.guides}>Guides</Link>
            </li>
            <li>
              <Link href={HOSTED_PATHS.labs}>Labs</Link>
            </li>
            <li>
              <a href="https://github.com/AlessandroFare/fluxychat" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            </li>
          </ul>
        </div>
        <div className={styles.footerCol}>
          <h3>Company</h3>
          <ul>
            <li>
              <Link href={HOSTED_PATHS.trust}>Trust</Link>
            </li>
            <li>
              <Link href={HOSTED_PATHS.status}>Status</Link>
            </li>
            <li>
              <Link href={HOSTED_PATHS.forTeams}>For teams</Link>
            </li>
            <li>
              <Link href={HOSTED_PATHS.support}>Support</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className={styles.wrap}>
        <div className={styles.footerBottom}>
          <span>© {year} FluxyChat. Hosted is beta. Pin SDK versions.</span>
          <span>
            <Link href={HOSTED_PATHS.terms}>Terms</Link> ·{" "}
            <Link href={HOSTED_PATHS.privacyPolicy}>Privacy</Link> ·{" "}
            <Link href={HOSTED_PATHS.dpa}>DPA</Link> ·{" "}
            <Link href={HOSTED_PATHS.subprocessors}>Subprocessors</Link> ·{" "}
            <a href="mailto:support@fluxychat.com">support@fluxychat.com</a>
          </span>
        </div>
      </div>
    </footer>
    </div>
  );
}
