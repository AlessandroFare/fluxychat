import type { Metadata } from "next";
import Link from "next/link";
import { PAGE_METADATA } from "@/lib/marketing-copy";
import { LANDING_FAQ } from "@/lib/marketing-faq";
import { MARKETING_FINAL_CTA } from "@/lib/marketing-landing";
import { formatNumber } from "@/lib/format-number";
import {
  HOSTED_PATHS,
  consoleEntryHref,
  docsSiteHref,
  isClerkClientConfigured,
} from "@/lib/hosted-product";
import { FREE_TIER_LIMITS, landingPlanEntries } from "@/lib/plan-catalog";
import { CloudflareCostTable } from "~/components/marketing/cloudflare-cost-table";
import { SpotlightCard } from "~/components/marketing/spotlight-card";
import { cMono, cSans } from "./c-fonts";
import { HighlightedCode } from "./landing-code";
import { LandingConsole } from "./landing-console";
import { CopyButton } from "./landing-copy";
import { LandingFooter, LandingHeader } from "./landing-chrome";
import { LandingIntro } from "./landing-intro";
import { LandingLiveRoom } from "./landing-live-room";
import { LandingMotion } from "./landing-motion";
import { LandingRoomAtlas } from "./landing-room-atlas";
import { ScrubText, SplitText } from "./landing-text";
import styles from "./landing-c.module.css";

export const metadata: Metadata = PAGE_METADATA.landing;

const QUICKSTART_SNIPPET = `import { FluxyRealtimeProvider, useChat } from "@fluxy-chat/react";

function App() {
  return (
    <FluxyRealtimeProvider
      workerUrl={process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL!}
      publishableKey="pk_..."
    >
      <Room />
    </FluxyRealtimeProvider>
  );
}

function Room() {
  const { messages, sendMessage, connectionState } = useChat({
    roomId: "general",
  });
}`;

const STEPS = [
  {
    term: "Wake",
    body: "A quiet room hibernates. The next message wakes the object with its state intact. No idle socket bill.",
  },
  {
    term: "Replay",
    body: "History lives in D1. After a reconnect the SDK resumes from a cursor instead of an empty screen.",
  },
  {
    term: "Invoke",
    body: "Agents stream replies and tool calls on the same WebSocket as the humans. One timeline, one replay.",
  },
] as const;

const USE_CASES = [
  {
    eyebrow: "Ops",
    title: "Incident room",
    body: "On-call and an agent that summarizes the last hour. Still chat, not PagerDuty.",
    href: "/incident",
  },
  {
    eyebrow: "Support",
    title: "Support copilot",
    body: "The bot drafts. A human can stop the stream, deny a tool, or take the thread.",
    href: "/support",
  },
  {
    eyebrow: "Engineering",
    title: "PR review room",
    body: "Reviewers and an agent on one timeline. Import is a JSON dump you already have.",
    href: "/pr-review",
  },
] as const;

export default function LandingHomePage() {
  const clerkOn = isClerkClientConfigured();
  const startHref = clerkOn ? HOSTED_PATHS.signUp : HOSTED_PATHS.getStarted;
  const plans = landingPlanEntries();

  return (
    <div className={`${styles.root} ${cSans.variable} ${cMono.variable}`}>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <LandingIntro />
      <div className={styles.progress} aria-hidden="true" />
      <LandingMotion />
      <LandingHeader startHref={startHref} accountHref={consoleEntryHref()} />

      <main id="main" tabIndex={-1}>
        <section className={`${styles.wrap} ${styles.hero}`}>
          <div className={styles.heroCopy}>
            <span className={styles.label}>In-app chat for SaaS</span>
            <h1 className={styles.display}>One room, one machine.</h1>
            <p className={styles.lead}>
              Every room runs as a single Durable Object on Cloudflare:{" "}
              <strong>state, presence and history in one place</strong>. Humans and agents on the
              same WebSocket. MIT when you want it on your own account.
            </p>
            <div className={styles.actions}>
              <Link href="/demo" className={`${styles.btn} ${styles.btnPrimary}`}>
                Open a demo room
              </Link>
              <a href={docsSiteHref("quickstart")} className={`${styles.btn} ${styles.btnGhost}`}>
                Read the quickstart
              </a>
            </div>
            <p className={styles.install}>
              <span className={styles.prompt}>$</span>
              <code>pnpm add @fluxy-chat/react</code>
              <CopyButton text="pnpm add @fluxy-chat/react" label="Copy install command" />
            </p>
          </div>
        </section>

        <LandingConsole />

        <section className={styles.specs} aria-label="Stack">
          <div className={`${styles.wrap} ${styles.specsGrid}`}>
            <section className={styles.spec}>
              <span className={styles.label}>Runtime</span>
              <p className={styles.specValue}>Worker + Durable Objects</p>
              <p className={styles.specText}>per room, with hibernation when quiet</p>
            </section>
            <section className={styles.spec}>
              <span className={styles.label}>History</span>
              <p className={styles.specValue}>D1</p>
              <p className={styles.specText}>every message kept and queryable</p>
            </section>
            <section className={styles.spec}>
              <span className={styles.label}>Client</span>
              <p className={styles.specValue}>@fluxy-chat/sdk · react</p>
              <p className={styles.specText}>one WebSocket, typed events</p>
            </section>
            <section className={styles.spec}>
              <span className={styles.label}>Licence</span>
              <p className={styles.specValue}>MIT</p>
              <p className={styles.specText}>self-host on your account, or hosted beta</p>
            </section>
          </div>
        </section>

        <section className={`${styles.section} ${styles.wrap}`} id="mechanism" data-fx>
          <div className={styles.chapterScenes} data-chapters>
            <div className={styles.chapterSticky}>
              <div className={styles.mechanism}>
                <div className={styles.mechanismCopy}>
                  <div data-fx-rise>
                    <span className={styles.label}>Kernel</span>
                    <h2 className={styles.h2}>
                      <SplitText text="The room is the unit." />
                    </h2>
                    <p className={styles.sectionLead}>
                      A message, a cursor, a tool call: they land in the same Durable Object. The
                      SDK replays from D1 after a reconnect. You do not keep a socket fleet alive
                      at 3am.
                    </p>
                  </div>
                  <div className={styles.chapterDeck} aria-label="How a room runs">
                    {STEPS.map((step, index) => (
                      <article key={step.term} className={styles.chapter} data-chapter>
                        <span className={styles.chapterIndex}>0{index + 1}</span>
                        <div>
                          <h3 className={styles.chapterTerm}>{step.term}</h3>
                          <p className={styles.chapterBody}>{step.body}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className={styles.chapterRail} aria-hidden="true">
                    <span className={styles.chapterRailTrack}>
                      <span className={styles.chapterRailFill} />
                    </span>
                    <span className={styles.chapterRailText} data-chapter-current>
                      01 / 03
                    </span>
                  </div>
                </div>
                <div className={styles.codePanel} data-fx-rise>
                  <div className={styles.codeHead}>
                    <span>app/room.tsx</span>
                    <span className={styles.codeMeta}>
                      <span>react</span>
                      <CopyButton text={QUICKSTART_SNIPPET} label="Copy code" />
                    </span>
                  </div>
                  <SpotlightCard
                    className="rounded-none bg-transparent shadow-none backdrop-blur-none"
                    spotlightColor="rgba(255, 106, 26, 0.12)"
                  >
                    <pre className={styles.codeBody}>
                      <code>
                        <HighlightedCode source={QUICKSTART_SNIPPET} />
                      </code>
                    </pre>
                  </SpotlightCard>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.wrap}`} id="use-cases" data-fx>
          <div className={styles.sectionHead} data-fx-rise>
            <span className={styles.label}>Use cases</span>
            <h2 className={styles.h2}>
              <ScrubText text="Three rooms teams build first." />
            </h2>
            <p className={styles.sectionLead}>
              Each is the same kernel with a different scaffold. The cards stack as you scroll;
              open one and change the copy.
            </p>
          </div>
          <div className={styles.stack}>
            {USE_CASES.map((item, index) => (
              <Link key={item.href} href={item.href} className={styles.stackItem}>
                <article className={styles.stackCard}>
                  <div className={styles.stackTop}>
                    <span className={styles.stackIndex}>0{index + 1}</span>
                    <span className={styles.stackEyebrow}>{item.eyebrow}</span>
                    <span className={styles.stackOpen}>
                      Open{" "}
                      <span className={styles.stackArrow} aria-hidden="true">
                        →
                      </span>
                    </span>
                  </div>
                  <h3 className={styles.stackTitle}>{item.title}</h3>
                  <p className={styles.stackBody}>{item.body}</p>
                  <span className={styles.stackGhost} aria-hidden="true">
                    0{index + 1}
                  </span>
                </article>
              </Link>
            ))}
          </div>
          <p className={styles.note}>
            More gallery apps in <Link href="/labs">Labs</Link>.
          </p>
        </section>

        <LandingRoomAtlas />

        <section className={`${styles.section} ${styles.wrap}`} id="live-room" data-fx>
          <div className={styles.sectionHead} data-fx-rise>
            <span className={styles.label}>Live</span>
            <h2 className={styles.h2}>
              <SplitText text="Click inside the room." />
            </h2>
            <p className={styles.sectionLead}>
              Presence, fan-out, agent and replay, simulated in your browser. Move the pointer: Sam
              is already in the room. Click to drop a note and every client sees it, exactly what
              the Worker does for real.
            </p>
          </div>
          <div className={styles.liveWrap} data-fx-rise>
            <LandingLiveRoom />
          </div>
        </section>

        <section className={`${styles.section} ${styles.wrap}`} id="pricing" data-fx>
          <div className={styles.sectionHead} data-fx-rise>
            <span className={styles.label}>Pricing</span>
            <h2 className={styles.h2}>
              <SplitText text="Free until the rooms get busy." />
            </h2>
            <p className={styles.sectionLead}>
              Free includes {formatNumber(FREE_TIER_LIMITS.messageLimitMonthly)} persisted
              messages, {formatNumber(FREE_TIER_LIMITS.agentInvokeLimitMonthly)} agent invokes and{" "}
              {formatNumber(FREE_TIER_LIMITS.webhookDeliveryLimitMonthly)} webhook deliveries per
              month. Agents are invokes, not seats. Hosted is beta; self-host is MIT.
            </p>
          </div>

          <div className={styles.plans} data-fx-rise>
            {plans.map(([key, plan]) => (
              <div
                key={key}
                className={`${styles.plan} ${key === "starter" ? styles.planFeatured : ""}`}
              >
                <div className={styles.planHead}>
                  <h3 className={styles.planName}>{plan.label}</h3>
                  <span className={styles.planPrice}>{plan.price}</span>
                </div>
                <p className={styles.planTagline}>{plan.tagline}</p>
                <dl className={styles.planLimits}>
                  <div className={styles.planLimit}>
                    <dt>messages / mo</dt>
                    <dd>
                      {plan.messages === -1 ? "fair use" : formatNumber(plan.messages)}
                    </dd>
                  </div>
                  <div className={styles.planLimit}>
                    <dt>agent invokes / mo</dt>
                    <dd>{plan.agents === -1 ? "fair use" : formatNumber(plan.agents)}</dd>
                  </div>
                  <div className={styles.planLimit}>
                    <dt>webhooks / mo</dt>
                    <dd>{plan.webhooks === -1 ? "fair use" : formatNumber(plan.webhooks)}</dd>
                  </div>
                </dl>
                <Link
                  href={key === "free" ? startHref : clerkOn ? HOSTED_PATHS.signUp : HOSTED_PATHS.getStarted}
                  className={styles.planCta}
                >
                  {key === "free" ? "Start free" : `Choose ${plan.label}`}
                </Link>
              </div>
            ))}
          </div>

          <p className={styles.note}>
            Self-serve Stripe checkout when the Worker has <code>STRIPE_SECRET_KEY</code>. If{" "}
            <code>/health.paymentsEnabled</code> is false, pick a plan in the console or email us.
            Cards will not charge. <Link href="/pricing">Full pricing</Link>.
          </p>
        </section>

        <section className={`${styles.section} ${styles.wrap}`} id="cloudflare-cost" data-fx>
          <div className={styles.sectionHead} data-fx-rise>
            <h2 className={styles.h2}>What does it actually cost on Cloudflare?</h2>
            <p className={styles.sectionLead}>
              Estimate only. Cloudflare&apos;s chat Durable Object sample was dominated by
              duration, not request count. We have not published idle-socket duration from a real
              invoice.{" "}
              <Link href={docsSiteHref("learn/status-and-limits")}>Status and limits</Link>.
            </p>
          </div>
          <div className={styles.costTable} data-fx-rise>
            <CloudflareCostTable variant="light" />
          </div>
        </section>

        <section className={`${styles.section} ${styles.wrap}`} id="faq" data-fx>
          <div className={styles.faqGrid} data-fx-rise>
            <div className={styles.faqIntro}>
              <span className={styles.label}>FAQ</span>
              <h2 className={styles.h2}>
                <SplitText text="Straight answers." />
              </h2>
              <p className={styles.sectionLead}>
                What this is, what it is not, and where the hosted beta stops.
              </p>
            </div>
            <div className={styles.faqList}>
              {LANDING_FAQ.map((item) => (
                <details key={item.q} className={styles.faqItem}>
                  <summary className={styles.faqSummary}>{item.q}</summary>
                  <p className={styles.faqBody}>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.finalCta}`} data-fx>
          <h2 className={styles.h2} data-fx-rise>
            <SplitText text={MARKETING_FINAL_CTA.title} />
          </h2>
          <p className={styles.sectionLead} data-fx-rise>
            {MARKETING_FINAL_CTA.body}
          </p>
          <div className={styles.actions}>
            <Link href={startHref} className={`${styles.btn} ${styles.btnPrimary}`}>
              {MARKETING_FINAL_CTA.primaryLabel}
            </Link>
            <a
              href={MARKETING_FINAL_CTA.secondaryHref}
              className={`${styles.btn} ${styles.btnGhost}`}
            >
              {MARKETING_FINAL_CTA.secondaryLabel}
            </a>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
