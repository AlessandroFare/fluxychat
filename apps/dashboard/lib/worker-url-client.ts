/** Browser-safe Worker base URL (matches server hosted-worker resolution). */
export function getPublicWorkerUrl(): string {
  const cloud = process.env.NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL?.trim();
  const worker = process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL?.trim();
  const base = cloud || worker || "http://127.0.0.1:8787";
  return base.replace(/\/$/, "");
}

export function isPublicHostedCloud(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL?.trim());
}
