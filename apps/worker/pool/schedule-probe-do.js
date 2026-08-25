import { DurableObject } from "cloudflare:workers";
import { WsSessionRegistry, installWsAutoResponse } from "../src/lib/do-ws-sessions.js";
import {
  ALARM_JOBS_KEY,
  parseAlarmJobs,
  scheduleDoAlarmJob,
  takeDueDoAlarmJobs,
} from "../src/lib/do-alarm-scheduler.js";
import {
  claimDueAgentSchedules,
  completeAgentScheduleFire,
  upsertAgentSchedule,
  withAgentScheduleRows,
} from "../src/lib/agent-schedules.js";
import { captureRoomPitrSnapshot, listRoomPitr } from "../src/lib/room-pitr.js";

/**
 * Minimal SQLite DO that runs the production alarm queue, agent-schedule claim,
 * hibernation registry, and PITR helpers inside workerd (CF-A-024).
 */
export class ScheduleProbeDo extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sessions = new WsSessionRegistry(ctx);
    installWsAutoResponse(ctx);
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/ws" && request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.sessions.accept(server, ["probe"]);
      this.sessions.field("u").set(server, "alice");
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === "/snapshot" && request.method === "GET") {
      return Response.json(await this.snapshot());
    }
    return new Response("not found", { status: 404 });
  }

  async enqueueJob(id, dueAt) {
    await scheduleDoAlarmJob(this.ctx.storage, id, dueAt, id);
    return { ok: true };
  }

  async upsertDelay(agentId, delayMs, now) {
    const result = await withAgentScheduleRows(this.ctx.storage, (rows) =>
      upsertAgentSchedule(
        rows,
        {
          kind: "delay",
          agentId,
          projectId: "p1",
          roomId: "r1",
          delayMs,
          prompt: "probe",
        },
        now,
      ),
    );
    return result;
  }

  async snapshot() {
    const jobs = parseAlarmJobs(await this.ctx.storage.get(ALARM_JOBS_KEY));
    const schedules = await withAgentScheduleRows(this.ctx.storage, (rows) => ({
      rows,
      schedules: rows.map((r) => ({
        id: r.id,
        status: r.status,
        nextRunAt: r.nextRunAt,
        claimedAt: r.claimedAt,
      })),
    }));
    const pitr = await listRoomPitr(this.ctx.storage);
    const sockets = this.ctx.getWebSockets?.() || [];
    const users = sockets.map((ws) => this.sessions.field("u").get(ws));
    return {
      jobIds: [...jobs.keys()],
      schedules: schedules.schedules || [],
      pitrAvailable: pitr.pitrAvailable,
      attachmentUsers: users,
      hibernationEnabled: this.sessions.hibernationEnabled,
    };
  }

  async checkpointPitr() {
    return captureRoomPitrSnapshot(this.ctx.storage, { label: "pool", force: true });
  }

  async alarm() {
    await takeDueDoAlarmJobs(this.ctx.storage);
    await withAgentScheduleRows(this.ctx.storage, (rows) => {
      const claimed = claimDueAgentSchedules(rows, Date.now());
      for (const row of claimed) {
        completeAgentScheduleFire(row, { ok: true, now: Date.now() });
      }
      return { rows };
    });
  }
}
