/**
 * Scheduled cron jobs via Cloudflare Workflows (P12-L).
 */
import { WorkflowEntrypoint } from "cloudflare:workers";
import { logError, logInfo } from "../lib/worker-log.js";
import { runScheduledCronJob } from "../lib/scheduled-runners.js";

export class FluxyScheduledWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const cron = event.schedule?.cron || "";
    logInfo("workflow.scheduled.start", {
      cron,
      scheduledTime: event.schedule?.scheduledTime,
    });

    await step.do(
      `cron:${cron || "default"}`,
      {
        retries: { limit: 3, delay: "30 seconds", backoff: "exponential" },
        timeout: "15 minutes",
      },
      async () => {
        try {
          const result = await runScheduledCronJob(this.env, cron);
          logInfo("workflow.scheduled.done", { cron, ...result });
          return result;
        } catch (err) {
          logError("workflow.scheduled.failed", err, { cron });
          throw err;
        }
      },
    );
  }
}
