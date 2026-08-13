"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, RotateCw, Shield } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { RoomPicker } from "../../components/room-picker";
import { Button, Panel, Section, Banner } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import { getRoomE2eKey, updateRoomE2e } from "@/lib/room-e2e-client";
import { getRoomMlsGroup, rotateRoomMlsEpoch, upsertRoomMlsGroup, type RoomMlsGroup } from "@/lib/room-mls-client";

function keyFingerprint(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length < 12) return "—";
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-6)}`;
}

export default function RoomE2eSettingsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [e2eEnabled, setE2eEnabled] = useState(false);
  const [keyFingerprintValue, setKeyFingerprintValue] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [mlsGroup, setMlsGroup] = useState<RoomMlsGroup | null>(null);

  const loadRoom = useCallback(async () => {
    if (!token || !roomId.trim()) {
      setE2eEnabled(false);
      setKeyFingerprintValue(null);
      setRevealedKey(null);
      setMlsGroup(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [data, mls] = await Promise.all([
        getRoomE2eKey(token, roomId.trim()),
        getRoomMlsGroup(token, roomId.trim()).catch(() => ({ group: null })),
      ]);
      setE2eEnabled(Boolean(data.e2eEnabled));
      setMlsGroup(mls.group);
      if (data.e2eKey) {
        setKeyFingerprintValue(keyFingerprint(data.e2eKey));
        setRevealedKey(data.e2eKey);
      } else {
        setKeyFingerprintValue(null);
        setRevealedKey(null);
      }
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load E2E settings"));
      setE2eEnabled(false);
      setKeyFingerprintValue(null);
    } finally {
      setLoading(false);
    }
  }, [token, roomId]);

  useEffect(() => {
    void loadRoom();
  }, [loadRoom]);

  async function setEnabled(next: boolean) {
    if (!token || !roomId.trim()) return;
    setBusy(next ? "enable" : "disable");
    setError(null);
    setNotice(null);
    try {
      await updateRoomE2e(token, roomId.trim(), { e2eEnabled: next });
      setNotice(next ? "Room E2E encryption enabled." : "Room E2E encryption disabled.");
      setShowKey(false);
      await loadRoom();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to update E2E"));
    } finally {
      setBusy(null);
    }
  }

  async function rotateKey() {
    if (!token || !roomId.trim() || !e2eEnabled) return;
    setBusy("rotate");
    setError(null);
    setNotice(null);
    try {
      await updateRoomE2e(token, roomId.trim(), { rotateE2eKey: true });
      setNotice("E2E key rotated. Members must fetch the new key via GET /rooms/:id/e2e-key.");
      setShowKey(false);
      await loadRoom();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to rotate E2E key"));
    } finally {
      setBusy(null);
    }
  }

  async function enableMlsGroup() {
    if (!token || !roomId.trim()) return;
    setBusy("mls-enable");
    setError(null);
    setNotice(null);
    try {
      const result = await upsertRoomMlsGroup(token, roomId.trim(), {});
      setMlsGroup(result.group);
      setNotice("MLS group registry created for this room.");
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to create MLS group"));
    } finally {
      setBusy(null);
    }
  }

  async function rotateMlsEpoch() {
    if (!token || !roomId.trim() || !mlsGroup) return;
    setBusy("mls-rotate");
    setError(null);
    setNotice(null);
    try {
      const result = await rotateRoomMlsEpoch(token, roomId.trim());
      setMlsGroup(result.group);
      setNotice(`MLS epoch rotated to ${result.group.epoch}.`);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to rotate MLS epoch"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Room E2E encryption"
        description="Shared AES-GCM room key distributed to members. Rotate keys on compromise or member offboarding."
      />

      {!token ? (
        <Banner variant="warn">Sign in with an admin JWT to manage room E2E.</Banner>
      ) : (
        <div className="space-y-6">
          <ConsoleFeedback error={error} notice={notice} />

          <Panel title="Room encryption">
            <Section title="Select room">
              <RoomPicker value={roomId} onChange={setRoomId} token={token} />
            </Section>

            {roomId.trim() ? (
              <div className="mt-4 space-y-4">
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading…
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={e2eEnabled ? "default" : "outline"}>
                        {e2eEnabled ? "E2E enabled" : "E2E disabled"}
                      </Badge>
                      {keyFingerprintValue ? (
                        <span className="text-xs text-muted-foreground">
                          Key fingerprint: <code className="font-mono">{keyFingerprintValue}</code>
                        </span>
                      ) : null}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Messages use JSON envelopes with <code className="font-mono">{"{\"e2e\":1}"}</code>.
                      Key material is wrapped at rest in D1; members fetch via authenticated GET.
                      When adding members to an E2E room, pass <code className="font-mono">rewrapE2eKey: true</code> on
                      POST /rooms/:id/members to rotate the shared key (audit logged).
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {!e2eEnabled ? (
                        <Button onClick={() => void setEnabled(true)} disabled={Boolean(busy)}>
                          {busy === "enable" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Shield className="mr-1 size-3.5" />}
                          Enable E2E
                        </Button>
                      ) : (
                        <>
                          <Button variant="outline" onClick={() => void setEnabled(false)} disabled={Boolean(busy)}>
                            Disable E2E
                          </Button>
                          <Button variant="outline" onClick={() => void rotateKey()} disabled={Boolean(busy)}>
                            {busy === "rotate" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <RotateCw className="mr-1 size-3.5" />}
                            Rotate key
                          </Button>
                          {revealedKey ? (
                            <Button variant="ghost" onClick={() => setShowKey((v) => !v)}>
                              <KeyRound className="mr-1 size-3.5" />
                              {showKey ? "Hide key" : "Reveal key (admin)"}
                            </Button>
                          ) : null}
                        </>
                      )}
                    </div>

                    {showKey && revealedKey ? (
                      <pre className="max-h-24 overflow-auto rounded-lg border border-amber-200 bg-amber-50 p-3 font-mono text-[10px] text-amber-900">
                        {revealedKey}
                      </pre>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </Panel>

          {roomId.trim() ? (
            <Panel title="MLS group registry">
              <p className="mb-3 text-xs text-muted-foreground">
                Server-side coordination for MLS groups: epoch and device roster in D1.
                Client encryption uses SDK <code className="font-mono">createMlsManager</code>.
              </p>
              {mlsGroup ? (
                <div className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="default">MLS active</Badge>
                    <span className="text-xs text-muted-foreground">Epoch {mlsGroup.epoch}</span>
                    <span className="text-xs text-muted-foreground">
                      {mlsGroup.devices.length}/{mlsGroup.maxDevices} devices
                    </span>
                  </div>
                  <code className="block truncate rounded bg-muted px-2 py-1 text-[10px]">{mlsGroup.groupId}</code>
                  <Button variant="outline" onClick={() => void rotateMlsEpoch()} disabled={Boolean(busy)}>
                    {busy === "mls-rotate" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <RotateCw className="mr-1 size-3.5" />}
                    Rotate MLS epoch
                  </Button>
                </div>
              ) : (
                <Button onClick={() => void enableMlsGroup()} disabled={Boolean(busy)}>
                  {busy === "mls-enable" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Shield className="mr-1 size-3.5" />}
                  Create MLS group registry
                </Button>
              )}
            </Panel>
          ) : null}
        </div>
      )}
    </ConsoleShell>
  );
}
