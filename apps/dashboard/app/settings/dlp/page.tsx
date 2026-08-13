"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Key, Loader2, Plus, Scan, Trash2 } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { Button, Input, Panel, Section, Textarea } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  createCmkKey,
  createDlpRule,
  deleteDlpRule,
  getDlpPolicyVersion,
  listCmkKeys,
  listDlpRules,
  revokeCmkKey,
  rotateCmkKey,
  scanDlpContent,
  type CmkKey,
  type DlpPolicyVersion,
  type DlpRule,
  type DlpScanResult,
} from "@/lib/dlp-cmk-client";

export default function DlpSettingsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [rules, setRules] = useState<DlpRule[]>([]);
  const [policyVersion, setPolicyVersion] = useState<DlpPolicyVersion | null>(null);
  const [cmkKeys, setCmkKeys] = useState<CmkKey[]>([]);

  const [ruleName, setRuleName] = useState("");
  const [rulePattern, setRulePattern] = useState("");
  const [ruleAction, setRuleAction] = useState("redact");
  const [ruleSeverity, setRuleSeverity] = useState("medium");

  const [scanText, setScanText] = useState("Test PCI 4111111111111111 and SSN 123-45-6789");
  const [contentKind, setContentKind] = useState("text");
  const [scanResult, setScanResult] = useState<DlpScanResult | null>(null);

  const loadAll = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [rulesRes, version, keysRes] = await Promise.all([
        listDlpRules(token),
        getDlpPolicyVersion(token),
        listCmkKeys(token),
      ]);
      setRules(rulesRes.rules ?? []);
      setPolicyVersion(version);
      setCmkKeys(keysRes.keys ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load DLP settings"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleCreateRule() {
    if (!token || !ruleName.trim() || !rulePattern.trim()) return;
    setBusy("rule");
    setNotice(null);
    try {
      await createDlpRule(token, {
        name: ruleName.trim(),
        pattern: rulePattern.trim(),
        action: ruleAction,
        severity: ruleSeverity,
      });
      setRuleName("");
      setRulePattern("");
      setNotice("DLP rule created.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to create rule"));
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteRule(ruleId: string) {
    if (!token) return;
    setBusy(ruleId);
    try {
      await deleteDlpRule(token, ruleId);
      setNotice("Rule deleted.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to delete rule"));
    } finally {
      setBusy(null);
    }
  }

  async function handleScan() {
    if (!token || !scanText.trim()) return;
    setBusy("scan");
    setScanResult(null);
    try {
      const result = await scanDlpContent(token, { text: scanText, contentKind });
      setScanResult(result);
      setNotice(`Scan complete: ${result.matchCount} match(es), action: ${result.action}`);
    } catch (err) {
      setError(messageFromUnknown(err, "DLP scan failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateCmkKey() {
    if (!token) return;
    setBusy("cmk-create");
    try {
      await createCmkKey(token);
      setNotice("CMK key created.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to create CMK key"));
    } finally {
      setBusy(null);
    }
  }

  async function handleRotateKey(keyId: string) {
    if (!token) return;
    setBusy(`rotate-${keyId}`);
    try {
      await rotateCmkKey(token, keyId);
      setNotice(`Key ${keyId} rotated.`);
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Key rotation failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleRevokeKey(keyId: string) {
    if (!token) return;
    setBusy(`revoke-${keyId}`);
    try {
      await revokeCmkKey(token, keyId);
      setNotice(`Key ${keyId} revoked.`);
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Key revoke failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="DLP &amp; encryption keys"
        description="Custom DLP rules, policy versioning, content scan, and customer-managed keys (CMK)."
      />
      <ConsoleFeedback error={error} notice={notice} />

      {!token && (
        <Panel className="p-4 text-sm text-muted-foreground">
          Admin JWT required. Copy one from <Link href="/projects" className="text-primary underline">Projects</Link>.
        </Panel>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {policyVersion && (
            <Section title="Policy version">
              <Panel className="p-4 text-sm space-y-1">
                <p><span className="text-muted-foreground">Version fingerprint:</span> <code className="text-xs">{policyVersion.version}</code></p>
                <p className="text-muted-foreground">
                  {policyVersion.builtinPatternCount} built-in patterns · {policyVersion.enabledRuleCount}/{policyVersion.customRuleCount} custom rules enabled
                </p>
              </Panel>
            </Section>
          )}

          <Section title="Custom DLP rules">
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel className="p-4 space-y-3">
                <Input placeholder="Rule name" value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
                <Input placeholder="Regex pattern" value={rulePattern} onChange={(e) => setRulePattern(e.target.value)} />
                <div className="flex gap-2">
                  <select className="rounded-md border border-border bg-background px-2 py-1.5 text-sm flex-1" value={ruleAction} onChange={(e) => setRuleAction(e.target.value)}>
                    <option value="redact">Redact</option>
                    <option value="block">Block</option>
                    <option value="alert">Alert</option>
                    <option value="log">Log</option>
                  </select>
                  <select className="rounded-md border border-border bg-background px-2 py-1.5 text-sm flex-1" value={ruleSeverity} onChange={(e) => setRuleSeverity(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <Button size="sm" disabled={!token || busy === "rule"} onClick={() => void handleCreateRule()}>
                  {busy === "rule" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                  Add rule
                </Button>
              </Panel>

              <Panel className="p-4 space-y-2">
                {rules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No custom rules yet. Built-in PHI/PCI patterns always apply.</p>
                ) : (
                  rules.map((rule) => (
                    <div key={rule.id} className="flex items-start justify-between gap-2 border-b border-border pb-2 last:border-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{rule.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{rule.pattern}</p>
                        <div className="mt-1 flex gap-1">
                          <Badge variant="outline" className="text-[9px]">{rule.action}</Badge>
                          <Badge variant="secondary" className="text-[9px]">{rule.severity}</Badge>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" disabled={busy === rule.id} onClick={() => void handleDeleteRule(rule.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </Panel>
            </div>
          </Section>

          <Section title="Content scan">
            <Panel className="p-4 space-y-3">
              <div className="flex gap-2">
                <select className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={contentKind} onChange={(e) => setContentKind(e.target.value)}>
                  <option value="text">Text</option>
                  <option value="file">File</option>
                  <option value="audio">Audio transcript</option>
                </select>
                <Button size="sm" disabled={!token || busy === "scan"} onClick={() => void handleScan()}>
                  {busy === "scan" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Scan className="h-3 w-3 mr-1" />}
                  Run scan
                </Button>
              </div>
              <Textarea rows={3} value={scanText} onChange={(e) => setScanText(e.target.value)} />
              {scanResult && (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1">
                  <p>Action: <strong>{scanResult.action}</strong> · Matches: {scanResult.matchCount}</p>
                  {scanResult.redactedText && <p className="text-muted-foreground">Redacted: {scanResult.redactedText}</p>}
                </div>
              )}
            </Panel>
          </Section>

          <Section title="Customer-managed keys (CMK)">
            <Panel className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Envelope encryption keys stored per tenant (KV metadata).</p>
                <Button size="sm" variant="outline" disabled={!token || busy === "cmk-create"} onClick={() => void handleCreateCmkKey()}>
                  {busy === "cmk-create" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Key className="h-3 w-3 mr-1" />}
                  New key
                </Button>
              </div>
              {cmkKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">No CMK keys yet.</p>
              ) : (
                cmkKeys.map((key) => (
                  <div key={key.keyId} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 last:border-0">
                    <div>
                      <p className="text-sm font-mono">{key.keyId}</p>
                      <p className="text-xs text-muted-foreground">{key.algorithm} · {formatDateTime(key.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={key.status === "active" ? "default" : "secondary"}>{key.status}</Badge>
                      {key.status === "active" && (
                        <>
                          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void handleRotateKey(key.keyId)}>Rotate</Button>
                          <Button size="sm" variant="destructive" disabled={!!busy} onClick={() => void handleRevokeKey(key.keyId)}>Revoke</Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </Panel>
          </Section>

          <p className="text-xs text-muted-foreground">
            Also see <Link href="/soc2" className="text-primary underline">SOC 2</Link> for audit export and quick DLP smoke tests.
          </p>
        </div>
      )}
    </ConsoleShell>
  );
}
