export { ScheduleProbeDo } from "./schedule-probe-do.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const name = url.searchParams.get("id") || "probe";
    const stub = env.SCHEDULE_PROBE.get(env.SCHEDULE_PROBE.idFromName(name));
    return stub.fetch(request);
  },
};
