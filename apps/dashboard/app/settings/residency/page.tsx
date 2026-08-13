"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Globe2, Loader2, Save } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { Button, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import {
  checkDataResidencyWrite,
  getDataResidencySettings,
  updateDataResidencySettings,
  type DataResidencySettings,
} from "@/lib/data-residency-client";

export default function DataResidencySettingsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [settings, setSettings] = useState<DataResidencySettings | null>(null);
  const [workerRegion, setWorkerRegion] = useState("");
  const [validRegions, setValidRegions] = useState<string[]>([]);
  const [writeOk, setWriteOk] = useState<boolean | null>(null);

  const [primaryRegion, setPrimaryRegion] = useState("eu-west");
  const [inferenceRegion, setInferenceRegion] = useState("eu-west");
  const [allowedRegions, setAllowedRegions] = useState<string[]>(["eu-west"]);
  const [enforceWrites, setEnforceWrites] = useState(true);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [res, check] = await Promise.all([
        getDataResidencySettings(token),
        checkDataResidencyWrite(token),
      ]);
      setSettings(res.settings);
      setWorkerRegion(res.workerRegion);
      setValidRegions(res.validRegions ?? []);
      setPrimaryRegion(res.settings.primaryRegion);
      setInferenceRegion(res.settings.inferenceRegion);
      setAllowedRegions(res.settings.allowedRegions);
      setEnforceWrites(res.settings.enforceWrites);
      setWriteOk(check.ok);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load data residency"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleAllowed(region: string) {
    setAllowedRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region],
    );
  }

  async function handleSave() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await updateDataResidencySettings(token, {
        primaryRegion,
        inferenceRegion,
        allowedRegions: allowedRegions.length ? allowedRegions : [primaryRegion],
        enforceWrites,
      });
      setSettings(result.settings);
      setNotice("Data residency policy saved.");
      const check = await checkDataResidencyWrite(token);
      setWriteOk(check.ok);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to save residency policy"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Data residency"
        description="Pin tenant data and inference to allowed regions. Writes are blocked when the worker region is outside policy."
      />

      <p className="mb-4 text-sm text-muted-foreground">
        <Link href="/settings" className="font-medium underline-offset-4 hover:underline">
          ← Settings
        </Link>
        {" · "}
        <Link href="/settings/ephemeral" className="font-medium underline-offset-4 hover:underline">
          Ephemeral TTL
        </Link>
      </p>

      <ConsoleFeedback error={error} notice={notice} />

      {!token ? (
        <Panel className="p-6 text-sm text-muted-foreground">Admin JWT required.</Panel>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin" aria-hidden /> Loading residency…
        </p>
      ) : (
        <div className="space-y-6">
          <Panel className="flex flex-wrap items-center gap-3 p-4">
            <Globe2 className="h-6 w-6 text-brand" aria-hidden />
            <div>
              <p className="font-medium">Worker region: {workerRegion || "unknown"}</p>
              <p className="text-xs text-muted-foreground">
                Set <code className="rounded bg-muted px-1">DATA_REGION</code> on the Worker to match deployment colo.
              </p>
            </div>
            {writeOk === true ? (
              <Badge variant="default">Writes allowed</Badge>
            ) : writeOk === false ? (
              <Badge variant="destructive">Writes blocked</Badge>
            ) : null}
          </Panel>

          <Section title="Region policy">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Primary region</span>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={primaryRegion}
                  onChange={(e) => setPrimaryRegion(e.target.value)}
                  aria-label="Primary data region"
                >
                  {validRegions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Inference region</span>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={inferenceRegion}
                  onChange={(e) => setInferenceRegion(e.target.value)}
                  aria-label="Inference region"
                >
                  {validRegions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset className="mt-4">
              <legend className="mb-2 text-sm font-medium">Allowed write regions</legend>
              <div className="flex flex-wrap gap-2">
                {validRegions.map((region) => {
                  const active = allowedRegions.includes(region);
                  return (
                    <button
                      key={region}
                      type="button"
                      aria-pressed={active}
                      className={`rounded-full border px-3 py-1 text-xs ${active ? "border-brand bg-brand/10 text-brand" : "border-border text-muted-foreground"}`}
                      onClick={() => toggleAllowed(region)}
                    >
                      {region}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enforceWrites}
                onChange={(e) => setEnforceWrites(e.target.checked)}
                aria-label="Enforce residency on writes"
              />
              Enforce residency on message writes (REST + WebSocket)
            </label>

            {settings?.updatedAt ? (
              <p className="mt-2 text-xs text-muted-foreground">Last updated policy loaded from server.</p>
            ) : null}

            <Button className="mt-4" disabled={busy} onClick={() => void handleSave()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Save className="mr-2 h-4 w-4" aria-hidden />}
              Save policy
            </Button>
          </Section>
        </div>
      )}
    </ConsoleShell>
  );
}
