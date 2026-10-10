"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Loader2, Radio, Users, Vote } from "lucide-react";
import {
  createCapabilityClient,
  type CapabilityClient,
} from "@fluxy-chat/sdk";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import {
  activateRoomTimer,
  checkInHybridEvent,
  closeLivePoll,
  closeRoomBreakout,
  createHybridEvent,
  createLiveStageEvent,
  createRoomBreakout,
  createRoomPoll,
  getLivePollResults,
  getRoomTimer,
  goLiveStageEvent,
  listRoomBreakouts,
  stopRoomTimer,
} from "@/lib/vertical-live-client";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";

type LiveVerticalId = "edu" | "events" | "health" | "finance" | "continuity";

interface VerticalLiveWorkspaceProps {
  verticalId: LiveVerticalId;
  roomId: string;
  token: string;
  adminToken?: string;
  onActivity?: (label: string) => void;
}

interface LiveFeedItem {
  id: string;
  label: string;
  at: string;
}

function formatTimerMs(timeMs?: number): string {
  const ms = Math.max(0, Math.floor(Number(timeMs) || 0));
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function verticalCapabilityType(verticalId: LiveVerticalId): string {
  if (verticalId === "edu") return "edu.session.started";
  if (verticalId === "events") return "event.stage.live";
  if (verticalId === "health") return "health.consent.verified";
  if (verticalId === "finance") return "finance.risk.flagged";
  return "continuity.checkpoint.created";
}

export function VerticalLiveWorkspace({
  verticalId,
  roomId,
  token,
  adminToken,
  onActivity,
}: VerticalLiveWorkspaceProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<LiveFeedItem[]>([]);
  const [pollTitle, setPollTitle] = useState("Quick knowledge check");
  const [breakoutName, setBreakoutName] = useState("Group A");
  const [breakouts, setBreakouts] = useState<Array<{ id: string; name: string; memberCount: number }>>([]);
  const [polls, setPolls] = useState<Array<{ id: string; title: string; closed?: boolean; options?: Array<{ text: string; votes: number }> }>>([]);
  const [stageTitle, setStageTitle] = useState("Main stage keynote");
  const [hybridEventId, setHybridEventId] = useState<string | null>(null);
  const [liveEventId, setLiveEventId] = useState<string | null>(null);
  const [whipUrl, setWhipUrl] = useState<string | null>(null);
  const [timer, setTimer] = useState<{ running?: boolean; timeMs?: number } | null>(null);
  const [auditEvents, setAuditEvents] = useState<Array<{ eventId: string; type: string; occurredAt: string }>>([]);

  const capabilityClient: CapabilityClient | null = useMemo(
    () => (token ? createCapabilityClient({ baseUrl: getPublicWorkerUrl(), token }) : null),
    [token],
  );

  const pushFeed = useCallback((label: string) => {
    const item = { id: crypto.randomUUID(), label, at: new Date().toLocaleTimeString() };
    setFeed((prev) => [item, ...prev].slice(0, 8));
    onActivity?.(label);
  }, [onActivity]);

  const refreshBreakouts = useCallback(async () => {
    if (!token || !roomId) return;
    const result = await listRoomBreakouts(token, roomId);
    setBreakouts(result.breakouts ?? []);
  }, [token, roomId]);

  const refreshTimer = useCallback(async () => {
    if (!token || !roomId || verticalId !== "edu") return;
    const result = await getRoomTimer(token, roomId);
    if (result.ok) setTimer(result.timer ?? null);
  }, [token, roomId, verticalId]);

  const refreshAudit = useCallback(async () => {
    if (!capabilityClient || !roomId) return;
    const result = await capabilityClient.list(roomId);
    if (!result.ok) return;
    const type = verticalCapabilityType(verticalId);
    const rows = (result.events ?? [])
      .filter((event) => event.type === type)
      .slice(-12)
      .reverse();
    setAuditEvents(rows.map((event) => ({
      eventId: event.eventId,
      type: event.type,
      occurredAt: event.occurredAt,
    })));
  }, [capabilityClient, roomId, verticalId]);

  useEffect(() => {
    setHybridEventId(null);
    setLiveEventId(null);
    setWhipUrl(null);
    setFeed([]);
    setNotice(null);
    setError(null);
    setPolls([]);
    setBreakouts([]);
    setTimer(null);
    setAuditEvents([]);
    if (verticalId === "edu") {
      void refreshBreakouts();
      void refreshTimer();
    }
    if (verticalId === "health" || verticalId === "finance" || verticalId === "continuity") {
      void refreshAudit();
    }
  }, [roomId, verticalId, refreshBreakouts, refreshTimer, refreshAudit]);

  useEffect(() => {
    if (verticalId !== "edu" || !timer?.running) return;
    const id = window.setInterval(() => {
      setTimer((prev) => {
        if (!prev?.running) return prev;
        return { ...prev, timeMs: Math.max(0, (prev.timeMs ?? 0) - 1000) };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [verticalId, timer?.running]);

  async function publishCapability(extra?: Record<string, unknown>) {
    if (!capabilityClient) throw new Error("Sign in to publish capability events");
    const type = verticalCapabilityType(verticalId);
    const result = await capabilityClient.publish({
      roomId,
      vertical: verticalId === "events" ? "event" : verticalId,
      type,
      actor: { id: "console", type: "user", role: "member" },
      idempotencyKey: `${type}-${roomId}-${Date.now()}`,
      payload: extra ?? {},
    });
    if (!result.ok) throw new Error(result.error || "publish_failed");
    pushFeed(`Capability · ${type}`);
  }

  async function runAction(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  const showEdu = verticalId === "edu";
  const showEvents = verticalId === "events";
  const showCompliance = verticalId === "health" || verticalId === "finance" || verticalId === "continuity";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="size-4" aria-hidden />
          Live workspace
        </CardTitle>
        <CardDescription>
          Calls hit room <span className="font-mono text-xs">{roomId}</span>. Polls and breakouts land on the same WebSocket as chat.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        {notice ? <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{notice}</p> : null}

        {showEdu ? (
          <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2">
                <Vote className="size-4" aria-hidden />
                <p className="font-medium">Launch poll</p>
              </div>
              <Input className="mt-3" value={pollTitle} onChange={(e) => setPollTitle(e.target.value)} placeholder="Poll title" />
              <Button
                type="button"
                size="sm"
                className="mt-3"
                disabled={!!busy}
                onClick={() => void runAction("poll", async () => {
                  const result = await createRoomPoll(token, {
                    roomId,
                    title: pollTitle,
                    options: ["A", "B", "C", "D"],
                  });
                  if (!result.ok) throw new Error(result.error || "poll_failed");
                  const pollId = result.id ?? result.poll?.id;
                  if (!pollId) throw new Error("poll_missing_id");
                  const tally = await getLivePollResults(token, pollId);
                  setPolls((prev) => [{
                    id: pollId,
                    title: tally.poll?.title ?? pollTitle,
                    closed: tally.poll?.isClosed,
                    options: tally.options,
                  }, ...prev]);
                  pushFeed(`Poll ${pollId.slice(0, 8)}`);
                  setNotice("Poll is open. Learners vote from the room. You cannot vote on your own poll.");
                })}
              >
                {busy === "poll" ? <Loader2 className="size-3 animate-spin" /> : null}
                Create poll
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 ml-2"
                disabled={!!busy}
                onClick={() => void runAction("attend", async () => {
                  if (!capabilityClient) throw new Error("Sign in to record attendance");
                  const result = await capabilityClient.publish({
                    roomId,
                    vertical: "edu",
                    type: "attendance.heartbeat",
                    actor: { id: "console", type: "user", role: "member" },
                    idempotencyKey: `attendance.heartbeat-${roomId}-${Date.now()}`,
                    payload: { source: "console" },
                  });
                  if (!result.ok) throw new Error(result.error || "attendance_failed");
                  pushFeed("Attendance heartbeat");
                  setNotice("Heartbeat stored on the room. Counts show in the metrics row.");
                })}
              >
                {busy === "attend" ? <Loader2 className="size-3 animate-spin" /> : null}
                Mark attendance
              </Button>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2">
                <Clock className="size-4" aria-hidden />
                <p className="font-medium">Class timer</p>
              </div>
              <p className="mt-2 font-mono text-sm tabular-nums">
                {formatTimerMs(timer?.timeMs)} {timer?.running ? "running" : "stopped"}
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-3"
                disabled={!!busy}
                onClick={() => void runAction("timer-start", async () => {
                  const result = await activateRoomTimer(token, roomId, {
                    mode: "timer",
                    timeMs: 5 * 60 * 1000,
                    running: true,
                  });
                  if (!result.ok) throw new Error(result.error || "timer_failed");
                  setTimer(result.timer ?? { running: true, timeMs: 5 * 60 * 1000 });
                  pushFeed("Timer 5:00 · D1");
                  setNotice("Room timer is on the Worker (`POST /rooms/:id/timer/activate`). Same fan-out as BBB timerActivate.");
                })}
              >
                {busy === "timer-start" ? <Loader2 className="size-3 animate-spin" /> : null}
                Start 5 min
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 ml-2"
                disabled={!!busy}
                onClick={() => void runAction("timer-stop", async () => {
                  const result = await stopRoomTimer(token, roomId);
                  if (!result.ok) throw new Error(result.error || "timer_stop_failed");
                  setTimer(result.timer ?? { running: false });
                  pushFeed("Timer stopped");
                })}
              >
                {busy === "timer-stop" ? <Loader2 className="size-3 animate-spin" /> : null}
                Stop
              </Button>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2">
                <Users className="size-4" aria-hidden />
                <p className="font-medium">Breakout group</p>
              </div>
              <Input className="mt-3" value={breakoutName} onChange={(e) => setBreakoutName(e.target.value)} placeholder="Breakout name" />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                disabled={!!busy}
                onClick={() => void runAction("breakout", async () => {
                  const result = await createRoomBreakout(token, roomId, breakoutName);
                  if (!result.ok) throw new Error(result.error || "breakout_failed");
                  await refreshBreakouts();
                  pushFeed(`Breakout · ${result.breakout?.name ?? breakoutName}`);
                  setNotice("Breakout is open. Close it from the list below.");
                })}
              >
                {busy === "breakout" ? <Loader2 className="size-3 animate-spin" /> : null}
                Open breakout
              </Button>
            </div>
          </div>
          {(polls.length > 0 || breakouts.length > 0) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border p-4">
                <p className="text-sm font-medium">Open polls</p>
                {polls.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">Create a poll to see tallies here.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {polls.map((poll) => (
                      <li key={poll.id} className="rounded-md border border-border px-2 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{poll.title}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!!busy || poll.closed}
                            onClick={() => void runAction(`close-${poll.id}`, async () => {
                              const result = await closeLivePoll(token, poll.id);
                              if (!result.ok) throw new Error(result.error || "close_failed");
                              const tally = await getLivePollResults(token, poll.id);
                              setPolls((prev) => prev.map((row) => row.id === poll.id
                                ? { ...row, closed: true, options: tally.options }
                                : row));
                              setNotice("Poll closed.");
                            })}
                          >
                            Close
                          </Button>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          {(poll.options ?? []).map((opt) => `${opt.text} ${opt.votes}`).join(" · ") || "No votes yet"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-sm font-medium">Breakouts</p>
                {breakouts.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">No open groups on this room.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {breakouts.map((group) => (
                      <li key={group.id} className="flex items-center justify-between gap-2 text-xs">
                        <span>{group.name} · {group.memberCount} people</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!!busy}
                          onClick={() => void runAction(`end-${group.id}`, async () => {
                            const result = await closeRoomBreakout(token, roomId, group.id);
                            if (!result.ok) throw new Error(result.error || "close_failed");
                            await refreshBreakouts();
                            setNotice("Breakout closed.");
                          })}
                        >
                          End
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
          </>
        ) : null}

        {showEvents ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <p className="font-medium">Main stage (FluxyStream)</p>
              <Input className="mt-3" value={stageTitle} onChange={(e) => setStageTitle(e.target.value)} placeholder="Stage title" />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!!busy || !adminToken}
                  onClick={() => void runAction("stage-create", async () => {
                    if (!adminToken) throw new Error("Admin JWT required for live stage");
                    const result = await createLiveStageEvent(adminToken, { roomId, title: stageTitle });
                    if (!result.event?.id) throw new Error(result.error || "stage_create_failed");
                    setLiveEventId(result.event.id);
                    pushFeed(`Stage scheduled · ${result.event.id}`);
                    setNotice("Live event created. Go live to auto-provision WHIP/RTMPS when Cloudflare Stream is configured.");
                  })}
                >
                  Schedule stage
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  disabled={!!busy || !adminToken || !liveEventId}
                  onClick={() => void runAction("stage-live", async () => {
                    if (!adminToken || !liveEventId) throw new Error("Create a stage first");
                    const result = await goLiveStageEvent(adminToken, liveEventId);
                    if (!result.event) throw new Error(result.error || "go_live_failed");
                    setWhipUrl(result.event.whipUrl ?? null);
                    pushFeed("Stage live · live.event_live");
                    setNotice(result.event.whipUrl
                      ? `WHIP ingest ready. HLS: ${result.event.playbackHls ?? "pending"}`
                      : "Stage is live. Configure CLOUDFLARE_STREAM_* on Worker for WHIP auto-provision.");
                  })}
                >
                  Go live
                </Button>
              </div>
              {whipUrl ? <p className="mt-2 font-mono text-xs break-all text-muted-foreground">WHIP: {whipUrl}</p> : null}
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="font-medium">Hybrid check-in</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!!busy || !adminToken}
                  onClick={() => void runAction("hybrid", async () => {
                    if (!adminToken) throw new Error("Admin JWT required for hybrid events");
                    const ev = await createHybridEvent(adminToken, { roomId, name: stageTitle, mode: "hybrid" });
                    setHybridEventId(ev.id);
                    pushFeed(`Hybrid event · ${ev.qrCode ?? ev.id}`);
                    setNotice("Hybrid event created. Remote attendees can check in next.");
                  })}
                >
                  Create hybrid event
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!!busy || !hybridEventId}
                  onClick={() => void runAction("checkin", async () => {
                    if (!hybridEventId) throw new Error("Create hybrid event first");
                    await checkInHybridEvent(token, hybridEventId, "remote");
                    pushFeed("Check-in · event.hybrid.checkin");
                    setNotice("Remote check-in recorded and fan-out to room.");
                  })}
                >
                  Remote check-in
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {showCompliance ? (
          <div className="rounded-xl border border-border p-4">
            <p className="font-medium">Compliance signal</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Publish a versioned capability event for audit trails: {verticalCapabilityType(verticalId)}.
            </p>
            {auditEvents.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {auditEvents.map((event) => (
                  <li key={event.eventId} className="flex justify-between gap-2 font-mono">
                    <span className="truncate">{event.type}</span>
                    <span className="shrink-0">{new Date(event.occurredAt).toLocaleTimeString()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">No rows yet for this room. Publish, then the list comes from D1.</p>
            )}
            <Button
              type="button"
              size="sm"
              className="mt-3"
              variant="outline"
              disabled={!!busy}
              onClick={() => void runAction("compliance", async () => {
                await publishCapability(
                  verticalId === "health"
                    ? { scope: "treatment", verified: true }
                    : verticalId === "finance"
                      ? { desk: "equities", session: "open" }
                      : { deviceClass: "mobile", trustScore: 0.92 },
                );
                await refreshAudit();
                setNotice("Capability event persisted. List below is GET /rooms/:id/capabilities/events.");
              })}
            >
              Publish compliance event
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {(showEdu || showEvents) ? (
            <Button
              type="button"
              size="sm"
              disabled={!!busy}
              onClick={() => void runAction("session", async () => {
                await publishCapability(
                  verticalId === "events" ? { stage: "keynote" } : { learnersPresent: 28 },
                );
                setNotice(`Published ${verticalCapabilityType(verticalId)} to room.`);
              })}
            >
              {busy === "session" ? <Loader2 className="size-3 animate-spin" /> : null}
              {verticalId === "events" ? "Announce stage live" : "Start live session"}
            </Button>
          ) : null}
        </div>

        {feed.length > 0 ? (
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent actions</p>
            <ul className="mt-2 flex flex-col gap-2">
              {feed.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{item.label}</span>
                  <Badge variant="outline" className="shrink-0 font-mono text-[10px]">{item.at}</Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
