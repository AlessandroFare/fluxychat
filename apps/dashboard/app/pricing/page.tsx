import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/site-metadata";
import { landingPlanEntries, type PublicPlanRow } from "@/lib/plan-catalog";
import { PRICING_FAQ } from "@/lib/marketing-landing";
import {
  HOSTED_COPY,
  HOSTED_PATHS,
  docsSiteHref,
  isClerkClientConfigured,
} from "@/lib/hosted-product";
import { formatNumber } from "@/lib/format-number";
import { MarketingShell } from "../components/marketing-shell";
import styles from "../landing/landing-c.module.css";

export const metadata: Metadata = buildPageMetadata({
  title: "Pricing",
  description:
    "Free weekend plan with pk_ in the browser. Paid plans for production traffic. Hosted is beta.",
  path: "/pricing",
});

const clerkOn = isClerkClientConfigured();
const planEntries = landingPlanEntries();
const planKeys = planEntries.map(([key]) => key);
const startHref = clerkOn ? HOSTED_PATHS.signUp : HOSTED_PATHS.getStarted;

function formatLimit(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

const COMPARISON_ROWS: { feature: string; values: Record<string, string> }[] = [
  {
    feature: "Messages / month",
    values: Object.fromEntries(
      planEntries.map(([key, plan]) => [
        key,
        plan.messages === -1 ? "Unlimited" : formatLimit(plan.messages),
      ]),
    ),
  },
  {
    feature: "Agent invokes / month",
    values: Object.fromEntries(
      planEntries.map(([key, plan]) => [
        key,
        plan.agents === -1 ? "Unlimited" : formatLimit(plan.agents),
      ]),
    ),
  },
  {
    feature: "Webhook deliveries / month",
    values: Object.fromEntries(
      planEntries.map(([key, plan]) => [
        key,
        plan.webhooks === -1 ? "Unlimited" : formatLimit(plan.webhooks),
      ]),
    ),
  },
  { feature: "Rooms", values: Object.fromEntries(planKeys.map((key) => [key, "Unlimited ids"])) },
  { feature: "Projects", values: { free: "1", starter: "1", pro: "1" } },
  { feature: "Team seats", values: { free: "1", starter: "1", pro: "1" } },
  { feature: "SDK & dashboard", values: Object.fromEntries(planKeys.map((key) => [key, "Yes"])) },
  {
    feature: "Platform modules",
    values: Object.fromEntries(planKeys.map((key) => [key, "Same room DO"])),
  },
  { feature: "AI agents", values: Object.fromEntries(planKeys.map((key) => [key, "Yes"])) },
  {
    feature: "Webhooks",
    values: { free: "No", starter: "Signed + retries", pro: "Signed + retries" },
  },
  { feature: "GDPR export", values: { free: "Worker API", starter: "Yes", pro: "Yes" } },
  {
    feature: "Priority support",
    values: { free: "Community", starter: "Email (best effort)", pro: "Priority" },
  },
  {
    feature: "SSO / SAML",
    values: { free: "Unavailable on hosted", starter: "Unavailable on hosted", pro: "Unavailable on hosted" },
  },
  { feature: "Audit logs", values: { free: "No", starter: "No", pro: "Contact us" } },
];

function PlanCard({ planKey, plan }: { planKey: string; plan: PublicPlanRow }) {
  const isFeatured = planKey === "starter";

  return (
    <div className={`${styles.planCard} ${isFeatured ? styles.planCardFeatured : ""}`}>
      <span className={styles.planTag}>{isFeatured ? "Most teams start here" : "Plan"}</span>
      <h2 className={styles.planName}>{plan.label}</h2>
      <div className={styles.planPrice}>{plan.price}</div>
      <p className={styles.planTagline}>{plan.tagline}</p>
      <ul className={styles.planList}>
        <li>
          {plan.messages === -1
            ? "Unlimited messages (fair use)"
            : `${formatNumber(plan.messages)} messages / month`}
        </li>
        <li>
          {plan.agents === -1
            ? "Unlimited agent invokes (fair use)"
            : `${formatNumber(plan.agents)} agent invokes / month`}
        </li>
        <li>
          {plan.webhooks === -1
            ? "Unlimited webhook deliveries (fair use)"
            : `${formatNumber(plan.webhooks)} webhook deliveries / month`}
        </li>
        {plan.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
      <div className={styles.planCta}>
        <Link
          href={startHref}
          className={`${styles.btn} ${isFeatured ? styles.btnPrimary : styles.btnGhost}`}
        >
          {planKey === "free" ? HOSTED_COPY.startFree : clerkOn ? `Choose ${plan.label}` : HOSTED_COPY.connectAccount}
        </Link>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <MarketingShell className={styles.pageWide}>
      <header className={styles.pageHero}>
        <div className={styles.pageHeroCopy}>
          <span className={styles.pageEyebrow}>Pricing / open beta</span>
          <h1 className={styles.pageTitle}>Pay for the room, not the seats.</h1>
          <p className={styles.pageLede}>
            Free is the weekend plan: public rooms, a <code>pk_</code> in the browser, no card.
            Starter is $20/mo when you outgrow 200k persisted messages. Pro is $50/mo for heavier
            traffic. Cursors and presence do not count as messages; agent invokes are not extra
            seats.
          </p>
          <div className={styles.pageActions}>
            <Link href={startHref} className={`${styles.btn} ${styles.btnPrimary}`}>
              {HOSTED_COPY.startFree}
            </Link>
            <a href="mailto:founder@fluxychat.com?subject=FluxyChat%20sales" className={`${styles.btn} ${styles.btnGhost}`}>
              Talk to sales
            </a>
          </div>
        </div>
        <div className={styles.pageMeta}>
          <span>
            <strong>Hosted</strong> beta
          </span>
          <span>
            <strong>SDK</strong> pin versions
          </span>
          <span>
            <strong>Self-host</strong> MIT
          </span>
        </div>
      </header>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>Plans</span>
          <h2 className={styles.pageH2}>One room. Three ways to run it.</h2>
        </div>
        <div className={styles.pageBody}>
          <div className={styles.planNote}>
            <strong>All plans include unlimited room ids.</strong> Message quotas count persisted
            chat and webhooked <code>client_event</code> frames. Cursors and{" "}
            <code>presence_patch</code> do not. Agents are invokes, not dashboard seats. Hosted is
            beta; pin <code>@fluxy-chat/sdk</code>.
          </div>
          <div className={styles.planGrid}>
            {planEntries.map(([key, plan]) => (
              <PlanCard key={key} planKey={key} plan={plan} />
            ))}
          </div>
          <p className={styles.sectionLead}>
            Higher limits: email{" "}
            <a href="mailto:founder@fluxychat.com">founder@fluxychat.com</a>. Hosted login does not
            include SAML. Self-host keeps the same SDK and moves the Worker to your Cloudflare
            account.
          </p>
        </div>
      </section>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>Compare</span>
          <h2 className={styles.pageH2}>Every feature, every plan.</h2>
        </div>
        <div className={styles.pageBody}>
          <div className={styles.pageTableWrap}>
            <table className={styles.pageTable}>
              <thead>
                <tr>
                  <th>Feature</th>
                  {planEntries.map(([key, plan]) => (
                    <th key={key}>{plan.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.feature}>
                    <td>{row.feature}</td>
                    {planKeys.map((key) => (
                      <td key={key}>{row.values[key] ?? "No"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>Included</span>
          <h2 className={styles.pageH2}>The kernel is the product.</h2>
        </div>
        <div className={styles.pageBody}>
          <div className={styles.pageCards}>
            {[
              {
                title: "Cloudflare Workers",
                body: "Runs on Cloudflare's global network. PoP count and edge RTT are Cloudflare's, not a FluxyChat-measured SLO.",
              },
              {
                title: "Encryption",
                body: "TLS in transit. Room envelopes use a Worker-wrapped key. The LLM sees plaintext when invokeAgent runs.",
              },
              {
                title: "Agents on the timeline",
                body: "invokeAgent writes chat messages. Streaming markdown, MCP tools, HITL. The side-panel copilot is UI you wire to your own model.",
              },
              {
                title: "Platform adapters",
                body: "React, Vue, and Svelte packages on npm. React Native on npm. Flutter, Swift, and KMP stay in this repo until they hit their registries.",
              },
              {
                title: "Operator console",
                body: "Rooms, agents, billing, and project keys. Hosted is beta.",
              },
              {
                title: "Real-time sync",
                body: "Durable Objects and WebSocket. Yjs is a second binary socket on the same room.",
              },
            ].map((feature) => (
              <div key={feature.title} className={styles.pageCard}>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>Questions</span>
          <h2 className={styles.pageH2}>Pricing, without the fog.</h2>
        </div>
        <div className={styles.pageBody}>
          <div className={styles.pageFaq}>
            {PRICING_FAQ.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.pageCta}>
        <div>
          <span className={styles.pageEyebrow}>Start</span>
          <p className={styles.pageH2}>Build for free this weekend.</p>
          <p>
            No credit card. Open beta, so pin SDK versions. The docs are the spec, not the compare
            table.
          </p>
        </div>
        <div className={styles.pageActions}>
          <Link href={startHref} className={`${styles.btn} ${styles.btnPrimary}`}>
            {HOSTED_COPY.startFree}
          </Link>
          <a href={docsSiteHref("quickstart")} className={`${styles.btn} ${styles.btnGhost}`}>
            Read the quickstart
          </a>
        </div>
      </div>
    </MarketingShell>
  );
}
