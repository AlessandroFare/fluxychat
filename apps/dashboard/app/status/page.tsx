import Link from "next/link";
import type { Metadata } from "next";
import { fetchWorkerHealth } from "@/lib/worker-health";
import { loadStatusIncidents } from "@/lib/status-incidents";
import { buildPageMetadata } from "@/lib/site-metadata";
import { MarketingShell } from "../components/marketing-shell";
import styles from "../landing/landing-c.module.css";

export const metadata: Metadata = buildPageMetadata({
  title: "System status: FluxyChat",
  description:
    "Public health endpoint for the FluxyChat chat API. Check operational status, bindings, and feature modes.",
  path: "/status",
});

export const dynamic = "force-dynamic";

function statusLabel(ok: boolean | undefined, degraded?: boolean): string {
  if (ok === undefined) return "Unknown";
  if (!ok) return "Major outage";
  if (degraded) return "Degraded";
  return "Operational";
}

function statusColor(ok: boolean | undefined, degraded?: boolean): string {
  if (ok === undefined) return "var(--ink-2)";
  if (!ok) return "#b42318";
  if (degraded) return "var(--brand-text)";
  return "var(--accent)";
}

export default async function StatusPage() {
  const health = await fetchWorkerHealth();
  const incidents = loadStatusIncidents();
  const ok = health.data?.ok;
  const degraded = health.data?.degraded;
  const label = statusLabel(ok, degraded);

  return (
    <MarketingShell className={styles.pageNarrow}>
      <header className={styles.pageHero}>
        <div className={styles.pageHeroCopy}>
          <span className={styles.pageEyebrow}>Status / worker health</span>
          <h1 data-testid="status-heading" className={styles.pageTitle}>
            System status.
          </h1>
          <p className={styles.pageLede}>
            Live <code>GET /health</code> for this Worker. Hosted is open beta. This page is not a
            published fleet SLO. Cloudflare PoP RTT is Cloudflare&apos;s.
          </p>
        </div>
        <div className={styles.pageMeta}>
          <span>
            <strong style={{ color: statusColor(ok, degraded) }}>{label}</strong>
          </span>
          <span>
            <strong>Worker</strong> /health
          </span>
          <span>
            <strong>Beta</strong> no SLO
          </span>
        </div>
      </header>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>Chat API</span>
          <h2 className={styles.pageH2}>The endpoint, not a promise.</h2>
        </div>
        <div className={styles.pageBody}>
          <div className={styles.pageTableWrap}>
            <table className={styles.pageTable}>
              <tbody>
                <tr>
                  <th>Endpoint</th>
                  <td>
                    <code>
                      {health.workerUrl}/health
                    </code>
                  </td>
                </tr>
                <tr>
                  <th>Status</th>
                  <td style={{ color: statusColor(ok, degraded) }}>{label}</td>
                </tr>
                {health.error ? (
                  <tr>
                    <th>Error</th>
                    <td style={{ color: "#b42318" }}>{health.error}</td>
                  </tr>
                ) : null}
                {health.httpStatus != null ? (
                  <tr>
                    <th>HTTP</th>
                    <td>{health.httpStatus}</td>
                  </tr>
                ) : null}
                {health.data?.version ? (
                  <tr>
                    <th>Version</th>
                    <td>{health.data.version}</td>
                  </tr>
                ) : null}
                {health.data?.ts ? (
                  <tr>
                    <th>Checked at</th>
                    <td>{new Date(health.data.ts).toISOString()}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {health.data?.checks ? (
        <section className={styles.pageSection}>
          <div className={styles.pageSectionHead}>
            <span className={styles.pageEyebrow}>Bindings</span>
            <h2 className={styles.pageH2}>What the Worker can see.</h2>
          </div>
          <div className={styles.pageBody}>
            <div className={styles.pageTableWrap}>
              <table className={styles.pageTable}>
                <tbody>
                  {Object.entries(health.data.checks).map(([key, value]) => (
                    <tr key={key}>
                      <th>{key}</th>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {health.data?.degradedFeatures ? (
        <section className={styles.pageSection}>
          <div className={styles.pageSectionHead}>
            <span className={styles.pageEyebrow}>Feature modes</span>
            <h2 className={styles.pageH2}>What is on, off, or degraded.</h2>
          </div>
          <div className={styles.pageBody}>
            <div className={styles.pageTableWrap}>
              <table className={styles.pageTable}>
                <tbody>
                  {Object.entries(health.data.degradedFeatures).map(([key, value]) => (
                    <tr key={key}>
                      <th>{key}</th>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>Incidents</span>
          <h2 className={styles.pageH2}>Active and recently resolved.</h2>
        </div>
        <div className={styles.pageBody}>
          {incidents.active.length === 0 ? (
            <p style={{ color: "var(--ink)" }}>All systems operational. No active incidents.</p>
          ) : (
            <ul>
              {incidents.active.map((incident) => (
                <li key={incident.title}>
                  <strong>{incident.title}</strong>
                  {incident.impact ? <p>{incident.impact}</p> : null}
                  {incident.summary ? <p>{incident.summary}</p> : null}
                </li>
              ))}
            </ul>
          )}

          {incidents.resolved.length > 0 ? (
            <>
              <h3>Recent resolved</h3>
              <ul>
                {incidents.resolved.slice(0, 5).map((incident) => (
                  <li key={`${incident.date}-${incident.title}`}>
                    <strong>{incident.title}</strong>
                    <p>
                      {[incident.date, incident.duration, incident.status].filter(Boolean).join(" · ")}
                    </p>
                    {incident.summary ? <p>{incident.summary}</p> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </section>

      <div className={styles.pageCta}>
        <div>
          <span className={styles.pageEyebrow}>Tenant view</span>
          <p className={styles.pageH2}>Your incidents, not ours.</p>
          <p>
            For tenant-specific incidents (webhook failures, quota spikes), open Analytics in the
            console after connecting your project.
          </p>
        </div>
        <div className={styles.pageActions}>
          <Link href="/analytics" className={`${styles.btn} ${styles.btnPrimary}`}>
            Open Analytics
          </Link>
          <Link href="/trust" className={`${styles.btn} ${styles.btnGhost}`}>
            Trust
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
