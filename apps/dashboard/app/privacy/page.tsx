"use client";

import React, { useState, useEffect } from "react";
import { Banner, Button, Section } from "../components/ui";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { useDashboardSession } from "../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import { fetchWorker, fetchWorkerJson } from "@/lib/worker-fetch";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { PRIVACY_UPDATED, RETENTION_DEFAULTS, SUB_PROCESSORS } from "@/lib/privacy-legal-copy";

const COOKIE_CONSENT_KEY = "fluxychat_cookie_consent";

const WORKER_URL = getPublicWorkerUrl();

export default function PrivacyPage() {
  const { memberJwt, adminJwt, activeProject } = useDashboardSession();
  const [consentGiven, setConsentGiven] = useState<"accepted" | "rejected" | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [gdprStatus, setGdprStatus] = useState<string | null>(null);
  const [gdprBusy, setGdprBusy] = useState<"export" | "delete" | "compliance" | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(COOKIE_CONSENT_KEY) : null;
    if (!stored) {
      setShowBanner(true);
    } else {
      setConsentGiven(stored as "accepted" | "rejected");
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setConsentGiven("accepted");
    setShowBanner(false);
  };

  const handleReject = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "rejected");
    setConsentGiven("rejected");
    setShowBanner(false);
  };

  const handleGdprExport = async () => {
    const token = memberJwt.trim() || adminJwt.trim();
    if (!token) {
      setGdprStatus(
        "Add a member or admin JWT from Onboarding (session) before exporting."
      );
      return;
    }
    setGdprBusy("export");
    setGdprStatus(null);
    try {
      const res = await fetchWorker(`${WORKER_URL}/gdpr/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const match = cd?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "gdpr-export.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setGdprStatus("Export downloaded.");
    } catch (e: unknown) {
      setGdprStatus(messageFromUnknown(e, "Export failed."));
    } finally {
      setGdprBusy(null);
    }
  };

  const handleGdprDelete = async () => {
    setShowDeleteModal(false);
    const token = adminJwt.trim();
    if (!token) {
      setGdprStatus(
        "Erasure requires an owner/admin JWT. Store the admin token from Onboarding in this session."
      );
      return;
    }
    setGdprBusy("delete");
    setGdprStatus(null);
    try {
      const body = await fetchWorkerJson<{ message?: string }>(`${WORKER_URL}/gdpr/delete`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setGdprStatus(body.message || "Erasure completed.");
    } catch (e: unknown) {
      setGdprStatus(messageFromUnknown(e, "Erasure failed."));
    } finally {
      setGdprBusy(null);
    }
  };

  const handleComplianceReport = async () => {
    const token = adminJwt.trim();
    if (!token) {
      setGdprStatus("Compliance report requires an owner/admin JWT.");
      return;
    }
    setGdprBusy("compliance");
    setGdprStatus(null);
    try {
      const data = await fetchWorkerJson<Record<string, unknown>>(
        `${WORKER_URL}/compliance/report`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance-report-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setGdprStatus("Compliance report downloaded.");
    } catch (e: unknown) {
      setGdprStatus(messageFromUnknown(e, "Compliance report failed."));
    } finally {
      setGdprBusy(null);
    }
  };

  return (
    <ConsoleShell className="max-w-3xl lg:max-w-3xl">
      <ConsolePageHeader
        title="Privacy"
        description="What we store, how long we keep it, and export or erasure for your project."
      />

      <Section title="Who is the controller?" description={`Updated ${PRIVACY_UPDATED}`}>
        <div className="text-sm leading-relaxed text-muted-foreground">
          <p className="mb-3">
            On <strong className="text-slate-800">hosted Fluxychat Cloud</strong>, we act as controller for account
            data needed to run the dashboard and provision your tenant. Chat content still lives in your project&apos;s
            Worker and D1 database.
          </p>
          <p>
            When you <strong className="text-slate-800">self-host</strong> the Worker in your Cloudflare account, you
            are the controller for end-user chat data. This page describes what the product stores by default; your DPA
            with us (if any) governs hosted services.
          </p>
        </div>
      </Section>

      <Section title="Data we process" description="By category">
        <div className="text-sm leading-relaxed text-muted-foreground">
          <p className="mb-3">For each project (tenant), the stack may store:</p>
          <ul className="mb-3 list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-slate-800">Account:</strong> user ids, project membership, roles, API key hashes
            </li>
            <li>
              <strong className="text-slate-800">Messages:</strong> body text, reactions, read receipts, room membership
            </li>
            <li>
              <strong className="text-slate-800">AI agents:</strong> prompts, model responses, token and cost metadata
            </li>
            <li>
              <strong className="text-slate-800">Usage:</strong> message, agent invoke, and webhook delivery counters
              for quotas
            </li>
            <li>
              <strong className="text-slate-800">Billing:</strong> plan name and status; card data stays with Stripe
            </li>
            <li>
              <strong className="text-slate-800">Operations:</strong> audit events, error logs, latency metrics
            </li>
          </ul>
          <p>We do not sell personal data or use chat content for advertising profiles.</p>
        </div>
      </Section>

      <Section title="Retention" description="Default periods (per data type)">
        <div className="text-sm leading-relaxed text-muted-foreground">
          <ul className="list-disc space-y-1.5 pl-5">
            {RETENTION_DEFAULTS.map((row) => (
              <li key={row.label}>
                <strong className="text-slate-800">{row.label}:</strong> {row.detail}
              </li>
            ))}
          </ul>
          <p className="mt-3">
            Project admins can set custom retention per type where the Worker supports it. Erasure via the GDPR delete
            endpoint redacts messages and removes related rows sooner than the default schedule.
          </p>
        </div>
      </Section>

      <Section title="Lawful bases (EU/UK GDPR)" description="Typical mapping">
        <div className="text-sm leading-relaxed text-muted-foreground">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-slate-800">Contract:</strong> providing chat, quotas, and billing you signed up for
            </li>
            <li>
              <strong className="text-slate-800">Legitimate interests:</strong> security monitoring, abuse prevention,
              product debugging (balanced against your rights)
            </li>
            <li>
              <strong className="text-slate-800">Legal obligation:</strong> records we must keep for tax or compliance
            </li>
            <li>
              <strong className="text-slate-800">Consent:</strong> non-essential cookies in this dashboard only if you
              accept them below
            </li>
          </ul>
        </div>
      </Section>

      <Section title="Sub-processors" description="Who may process data on your behalf">
        <div className="text-sm leading-relaxed text-muted-foreground">
          <p className="mb-3">Depending on how you deploy:</p>
          <ul className="list-disc space-y-2 pl-5">
            {SUB_PROCESSORS.map((sp) => (
              <li key={sp.name}>
                <strong className="text-slate-800">{sp.name}</strong> — {sp.role}
              </li>
            ))}
          </ul>
          <p className="mt-3">
            You choose LLM providers and regions in agent settings. Their terms apply to content sent for inference.
          </p>
        </div>
      </Section>

      <Section title="International transfers" description="Outside the EEA">
        <div className="text-sm leading-relaxed text-muted-foreground">
          <p>
            Cloudflare, Clerk, Stripe, and LLM vendors may process data in the US or other countries. They typically rely
            on Standard Contractual Clauses or equivalent safeguards. Self-hosting in a Cloudflare region you select
            does not by itself remove transfers to LLM APIs you configure.
          </p>
        </div>
      </Section>

      <Section title="Your rights (GDPR)" description="Export, erasure, and related requests">
        <div className="text-sm text-muted-foreground leading-relaxed">
          <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
            <li><strong>Access:</strong> download your data (GDPR export endpoint)</li>
            <li><strong>Erasure:</strong> request deletion (GDPR delete endpoint, admin JWT)</li>
            <li><strong>Rectification:</strong> contact support to fix inaccurate records</li>
            <li><strong>Portability:</strong> JSON export from the same endpoints</li>
            <li><strong>Object:</strong> opt out of non-essential processing where applicable</li>
          </ul>
          <p style={{ marginBottom: 12 }}>
            Export uses the member or admin JWT in this browser session (the user id inside that token). Erasure needs an
            owner or admin JWT and only affects that user id in{" "}
            {activeProject?.name ? (
              <strong>{activeProject.name}</strong>
            ) : (
              "the active project"
            )}
            .
          </p>
          {gdprStatus ? (
            <Banner variant={gdprStatus.toLowerCase().includes("fail") ? "error" : "info"}>{gdprStatus}</Banner>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <Button
              variant="primary"
              onClick={() => void handleGdprExport()}
              disabled={gdprBusy !== null}
            >
              {gdprBusy === "export" ? "Exporting\u2026" : "Download GDPR export (JSON)"}
            </Button>
            <Button onClick={() => setShowDeleteModal(true)} disabled={gdprBusy !== null}>
              {gdprBusy === "delete" ? "Processing\u2026" : "Request data erasure (admin JWT)"}
            </Button>
            {adminJwt.trim() && (
              <Button onClick={() => void handleComplianceReport()} disabled={gdprBusy !== null}>
                {gdprBusy === "compliance" ? "Generating\u2026" : "Download compliance report (admin)"}
              </Button>
            )}
          </div>
        </div>
      </Section>

      <Section title="AI processing" description="What leaves your project for LLM providers">
        <div className="text-sm text-muted-foreground leading-relaxed">
          <p style={{ marginBottom: 12 }}>
            When someone talks to an in-room agent:
          </p>
          <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
            <li>Your message and up to the last 30 messages in the room go to the LLM you configured (OpenAI, Anthropic, or your gateway)</li>
            <li>Those vendors process data under their own terms; check their DPA before production use</li>
            <li>Responses plus token, latency, and cost metadata are stored in your project D1 database</li>
            <li>We do not use your content to train foundation models</li>
          </ul>
        </div>
      </Section>

      <Section title="Security" description="Basics for this stack">
        <div className="text-sm text-muted-foreground leading-relaxed">
          <ul style={{ paddingLeft: 20 }}>
            <li>All data encrypted in transit via TLS</li>
            <li>API keys stored as SHA-256 hashes, never in plaintext</li>
            <li>Webhook secrets hashed at rest, never exposed in API responses after creation</li>
            <li>JWT authentication required for all endpoints</li>
            <li>SSRF protection on all user-supplied URLs</li>
            <li>Input validation and XSS prevention on all endpoints</li>
            <li>Audit log for admin actions</li>
          </ul>
        </div>
      </Section>

      <Section title="Cookies" description="What the dashboard stores locally">
        <div className="text-sm text-muted-foreground leading-relaxed">
          <p style={{ marginBottom: 12 }}>Fluxychat uses minimal browser storage:</p>
          <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
            <li><strong>Session storage:</strong> JWT for Worker calls (cleared when you close the tab)</li>
            <li><strong>Local storage:</strong> cookie consent choice on marketing pages</li>
            <li><strong>Clerk (if enabled):</strong> session cookies for dashboard sign-in; see Clerk&apos;s policy</li>
            <li><strong>No ad tracking:</strong> we do not run analytics or ad pixels in this app</li>
          </ul>
          {consentGiven && (
            <Banner variant="success">
              Current preference: {consentGiven === "accepted" ? "Essential cookies accepted" : "Only essential cookies"}
            </Banner>
          )}
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <Button variant="primary" onClick={handleAccept} disabled={consentGiven === "accepted"}>
              Accept essential cookies
            </Button>
            <Button onClick={handleReject} disabled={consentGiven === "rejected"}>
              Reject non-essential
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Contact" description="Questions about your data?">
        <div className="text-sm text-muted-foreground leading-relaxed">
          <p>For privacy questions, contact your project admin or support@fluxychat.dev.</p>
        </div>
      </Section>

      {showDeleteModal && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="w-[90%] max-w-[520px] rounded-xl border border-[#334155] bg-[#1e293b] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-lg font-semibold text-[#f87171]">Confirm erasure</h2>
            <div className="mb-4 text-sm leading-relaxed text-muted-foreground">
              <p className="mb-2">
                This permanently redacts messages and deletes reactions, read receipts, memberships, and mentions for
                the user id in your admin JWT, in project{" "}
                <strong>{activeProject?.name || "the active project"}</strong>. You cannot undo it.
              </p>
              <ul className="mb-2 list-disc space-y-1 pl-5">
                <li>Message bodies become <code>[REDACTED BY GDPR ERASURE REQUEST]</code></li>
                <li>Related rows listed above are removed</li>
                <li>An audit event is written for compliance</li>
              </ul>
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowDeleteModal(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => void handleGdprDelete()}
                className="bg-red-600"
              >
                Confirm Erasure
              </Button>
            </div>
          </div>
        </div>
      )}

      {showBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-[1000] flex items-center justify-between gap-4 border-t border-black/[0.08] bg-white/95 px-6 py-4 shadow-[var(--shadow-subtle-3)] backdrop-blur-md"
        >
          <span className="text-sm text-slate-700">
            We use essential cookies for authentication. No tracking or third-party cookies.
          </span>
          <div className="flex gap-2">
            <Button variant="primary" onClick={handleAccept}>Accept</Button>
            <Button onClick={handleReject}>Reject</Button>
          </div>
        </div>
      )}
    </ConsoleShell>
  );
}
