import { getWorkerUrl } from "@/lib/hosted-worker";

export interface WorkerHealthPayload {
  ok: boolean;
  degraded?: boolean;
  ts: number;
  version?: string;
  projectId?: string | null;
  checks?: Record<string, string>;
  platformBindings?: Record<string, string>;
  degradedFeatures?: Record<string, string>;
  paymentsEnabled?: boolean;
}

export interface WorkerHealthResult {
  workerUrl: string;
  httpStatus: number | null;
  data: WorkerHealthPayload | null;
  error: string | null;
}

export async function fetchWorkerHealth(): Promise<WorkerHealthResult> {
  const workerUrl = getWorkerUrl();
  try {
    const res = await fetch(`${workerUrl}/health`, {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    const data = (await res.json()) as WorkerHealthPayload;
    return {
      workerUrl,
      httpStatus: res.status,
      data,
      error: null,
    };
  } catch (err) {
    return {
      workerUrl,
      httpStatus: null,
      data: null,
      error: err instanceof Error ? err.message : "Worker unreachable",
    };
  }
}
