/**
 * Worker URL resolution — hosted cloud first, then explicit worker URL, then local dev.
 */

const LOCAL_DEV_WORKER = "http://127.0.0.1:8787";

export function getWorkerUrl(): string {
  const cloud = process.env.NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL?.trim();
  const workerPublic = process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL?.trim();
  const workerServer = process.env.FLUXYCHAT_WORKER_URL?.trim();
  const base = cloud || workerPublic || workerServer || LOCAL_DEV_WORKER;
  return base.replace(/\/$/, "");
}

/** True when the dashboard is configured to talk to a hosted cloud API (not only localhost). */
export function isHostedCloudMode(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL?.trim());
}

export function getHostedWorkerConfig() {
  return {
    workerUrl: getWorkerUrl(),
    hostedCloud: isHostedCloudMode(),
    cloudUrl: process.env.NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL?.trim() || null,
  };
}
