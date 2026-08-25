/**
 * Durable Object alarm queue.
 *
 * Cloudflare exposes a single `storage.setAlarm()` slot per DO. Competing
 * callers that each call setAlarm() clobber earlier deadlines (expiry vs
 * scheduled messages vs ephemeral cleanup). This module keeps a named job
 * map in DO storage and always arms the slot at the earliest due time.
 */

export const ALARM_JOBS_KEY = "do:alarm-jobs:v1";

/** @typedef {{ dueAt: number, kind: string }} AlarmJob */

/**
 * @param {Map<string, AlarmJob> | Record<string, AlarmJob> | null | undefined} raw
 * @returns {Map<string, AlarmJob>}
 */
export function parseAlarmJobs(raw) {
  const map = new Map();
  if (!raw) return map;
  const entries = raw instanceof Map ? raw.entries() : Object.entries(raw);
  for (const [id, job] of entries) {
    const dueAt = Number(job?.dueAt);
    const kind = typeof job?.kind === "string" ? job.kind : String(id);
    if (!id || !Number.isFinite(dueAt)) continue;
    map.set(String(id), { dueAt, kind });
  }
  return map;
}

/**
 * @param {Map<string, AlarmJob>} jobs
 * @returns {number | null}
 */
export function earliestDueAt(jobs) {
  let min = null;
  for (const job of jobs.values()) {
    if (min == null || job.dueAt < min) min = job.dueAt;
  }
  return min;
}

/**
 * @param {Map<string, AlarmJob>} jobs
 * @param {number} now
 * @returns {{ due: Array<{ id: string } & AlarmJob>, remaining: Map<string, AlarmJob> }}
 */
export function splitDueAlarmJobs(jobs, now = Date.now()) {
  const remaining = new Map();
  const due = [];
  for (const [id, job] of jobs) {
    if (job.dueAt <= now) due.push({ id, ...job });
    else remaining.set(id, job);
  }
  due.sort((a, b) => a.dueAt - b.dueAt);
  return { due, remaining };
}

function jobsToRecord(jobs) {
  /** @type {Record<string, AlarmJob>} */
  const rec = {};
  for (const [id, job] of jobs) rec[id] = job;
  return rec;
}

/**
 * Upsert a named job and arm the DO alarm at the earliest remaining deadline.
 *
 * @param {{ get: Function, put: Function, setAlarm?: Function, deleteAlarm?: Function, getAlarm?: Function }} storage
 * @param {string} jobId
 * @param {number} dueAt
 * @param {string} [kind]
 */
export async function scheduleDoAlarmJob(storage, jobId, dueAt, kind = jobId) {
  if (!storage || typeof storage.setAlarm !== "function") return;
  const id = String(jobId || "").trim();
  const when = Number(dueAt);
  if (!id || !Number.isFinite(when)) return;

  const jobs = parseAlarmJobs(await storage.get(ALARM_JOBS_KEY));
  jobs.set(id, { dueAt: when, kind: String(kind || id) });
  await persistAndArm(storage, jobs);
}

/**
 * Drop a named job (e.g. nothing left to expire) and re-arm or clear.
 *
 * @param {{ get: Function, put: Function, setAlarm?: Function, deleteAlarm?: Function }} storage
 * @param {string} jobId
 */
export async function cancelDoAlarmJob(storage, jobId) {
  if (!storage) return;
  const jobs = parseAlarmJobs(await storage.get(ALARM_JOBS_KEY));
  if (!jobs.delete(String(jobId))) return;
  await persistAndArm(storage, jobs);
}

/**
 * Pop every job whose dueAt has arrived. Remaining jobs re-arm the slot.
 *
 * @param {{ get: Function, put: Function, setAlarm?: Function, deleteAlarm?: Function }} storage
 * @param {number} [now]
 * @returns {Promise<Array<{ id: string } & AlarmJob>>}
 */
export async function takeDueDoAlarmJobs(storage, now = Date.now()) {
  if (!storage) return [];
  const jobs = parseAlarmJobs(await storage.get(ALARM_JOBS_KEY));
  const { due, remaining } = splitDueAlarmJobs(jobs, now);
  await persistAndArm(storage, remaining);
  return due;
}

/**
 * @param {{ put: Function, setAlarm?: Function, deleteAlarm?: Function }} storage
 * @param {Map<string, AlarmJob>} jobs
 */
async function persistAndArm(storage, jobs) {
  await storage.put(ALARM_JOBS_KEY, jobsToRecord(jobs));
  const next = earliestDueAt(jobs);
  if (next == null) {
    if (typeof storage.deleteAlarm === "function") await storage.deleteAlarm();
    return;
  }
  if (typeof storage.setAlarm !== "function") return;
  await storage.setAlarm(next);
}
