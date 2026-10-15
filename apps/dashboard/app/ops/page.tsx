"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardCheck, Loader2, Send } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Banner, Button, Panel, Section, Textarea } from "../components/ui";
import { useDashboardSession } from "../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import {
  opsBuilderChat,
  opsDecideApproval,
  opsPublish,
  opsPublishRequest,
  opsStartRun,
  type OpsChatResult,
} from "@/lib/ops-client";

const EXAMPLES = [
  "When someone requests time off, their manager approves and HR is notified.",
  "Production access needs a security review, two-person approval, then the IAM tool runs.",
  "Supplier invoices: extract the file, check the orders view, finance approves, then register payment.",
  "P1 incident: on-call reviews, commander approves the comms, then notify engineering.",
];

export default function OpsBuilderPage() {
  const { memberJwt, adminJwt } = useDashboardSession();
  const token = memberJwt.trim() || adminJwt.trim();
  const [text, setText] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OpsChatResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null);

  async function submit(prompt?: string) {
    const message = (prompt ?? text).trim();
    if (!token || !message) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await opsBuilderChat(token, message, sessionId);
      setResult(next);
      setSessionId(next.session?.id);
      setText("");
    } catch (err) {
      setError(messageFromUnknown(err, "Could not draft this process"));
    } finally {
      setBusy(false);
    }
  }

  async function requestPublish() {
    const versionId = result?.drafted?.version?.id;
    if (!token || !versionId) return;
    setBusy(true);
    try {
      const req = await opsPublishRequest(token, versionId);
      if (!req.approvalId) {
        setError(req.error || "A reviewer must approve publication");
        return;
      }
      setPendingApprovalId(req.approvalId);
      setNotice("A reviewer must approve this exact draft. The builder cannot publish by itself.");
    } catch (err) {
      setError(messageFromUnknown(err, "Publish request failed"));
    } finally {
      setBusy(false);
    }
  }

  async function approvePublish() {
    const versionId = result?.drafted?.version?.id;
    if (!token || !pendingApprovalId || !versionId) return;
    setBusy(true);
    setError(null);
    try {
      await opsDecideApproval(token, pendingApprovalId, "approve", versionId);
      await opsPublish(token, pendingApprovalId);
      setNotice("Published. You can start a run.");
      setPendingApprovalId(null);
    } catch (err) {
      setError(messageFromUnknown(err, "Reviewer approval failed"));
    } finally {
      setBusy(false);
    }
  }

  async function startRun() {
    const versionId = result?.drafted?.version?.id;
    if (!token || !versionId) return;
    setBusy(true);
    try {
      const started = await opsStartRun(token, { versionId });
      setNotice(`Run ${started.run.id} is ${started.run.status}. Open Runs to complete tasks.`);
    } catch (err) {
      setError(messageFromUnknown(err, "This version is not published yet"));
    } finally {
      setBusy(false);
    }
  }

  const lintOk = result?.drafted?.lint?.ok;
  const steps = result?.drafted?.definition?.steps || [];

  return (
    <ConsoleShell>
      <ConsolePageHeader
        icon={ClipboardCheck}
        title="Processes"
        description="Describe how work should flow. The assistant drafts a process from your connected tools — no YAML. People still approve anything that writes data."
        actions={
          <div className="flex gap-2">
            <Link
              href="/ops/runs"
              className="inline-flex h-7 items-center rounded-md border border-border bg-background px-2.5 text-xs font-semibold hover:bg-muted/60"
            >
              Runs
            </Link>
            <Link
              href="/ops/settings"
              className="inline-flex h-7 items-center rounded-md border border-border bg-background px-2.5 text-xs font-semibold hover:bg-muted/60"
            >
              Tools and policy
            </Link>
          </div>
        }
      />

      {!token ? (
        <Banner variant="warn">Sign in to the console with a project token to draft processes.</Banner>
      ) : null}
      {error ? <Banner variant="error">{error}</Banner> : null}
      {notice ? <Banner variant="info">{notice}</Banner> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Describe the work"
          description="Use everyday language. The builder only uses tools your admin enabled. It will ask if something is missing."
        >
          <div className="mb-3 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="rounded-full border border-border px-3 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
                onClick={() => void submit(example)}
              >
                {example.slice(0, 48)}…
              </button>
            ))}
          </div>
          <Textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Example: When a new hire starts, security approves laptop access, IT provisions accounts, then notify the manager."
          />
          <div className="mt-3 flex justify-end">
            <Button type="button" onClick={() => void submit()} disabled={busy || !token || !text.trim()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Draft process
            </Button>
          </div>
          {result?.reply ? <p className="mt-4 text-sm leading-relaxed text-foreground">{result.reply}</p> : null}
        </Section>

        <Section title="Live draft" description="Plain-language summary. Writes never run without a person approving the exact payload.">
          {!result ? (
            <p className="text-sm text-muted-foreground">The diagram and steps appear here after you send a request.</p>
          ) : (
            <>
              {result.drafted.missing?.length ? (
                <Banner variant="warn">Missing connections: {result.drafted.missing.join(", ")}</Banner>
              ) : null}
              {result.drafted.questions?.length ? (
                <Banner variant="info">{result.drafted.questions.join(" ")}</Banner>
              ) : null}
              <p className="mb-3 text-sm font-medium">{result.panel?.summary || "Draft"}</p>
              <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm">
                {steps
                  .filter((s) => s.type !== "end")
                  .map((step) => (
                    <li key={step.id}>
                      <span className="font-medium">{step.id}</span> — {step.type.replaceAll("_", " ")}
                    </li>
                  ))}
              </ol>
              {lintOk ? (
                <p className="mb-3 text-sm text-emerald-800 dark:text-emerald-200">Guardrails passed. Ready for human publish.</p>
              ) : (
                <ul className="mb-3 text-sm text-red-800 dark:text-red-200">
                  {(result.drafted.lint?.errors || []).map((err) => (
                    <li key={err.code + err.message}>{err.message}</li>
                  ))}
                </ul>
              )}
              {result.panel?.assumptions?.length ? (
                <p className="mb-3 text-xs text-muted-foreground">Assumptions: {result.panel.assumptions.join(" ")}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => void requestPublish()} disabled={busy || !lintOk}>
                  Request publish
                </Button>
                {pendingApprovalId ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => void approvePublish()} disabled={busy}>
                    Reviewer: approve publish
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="outline" onClick={() => void startRun()} disabled={busy}>
                  Start a run
                </Button>
              </div>
            </>
          )}
        </Section>
      </div>

      <Panel className="mt-6 text-sm text-muted-foreground">
        Admins enable tools under Tools and policy. External guests only get a signed link with upload or comment rights.
        Every write is hashed: if the payload changes after approval, the approval is void.
      </Panel>
    </ConsoleShell>
  );
}
