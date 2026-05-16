import { messageFromUnknown } from "@/lib/error-message";

export interface WorkerErrorBody {
  error?: string;
  message?: string;
  traceId?: string;
}

export const WORKER_TRACE_HEADER = "x-trace-id";

export function readWorkerTraceId(res: Response): string | undefined {
  const value = res.headers.get(WORKER_TRACE_HEADER);
  return value && value.trim() ? value.trim() : undefined;
}

function readWorkerErrorMessage(
  body: WorkerErrorBody,
  status: number,
  traceId?: string
): string {
  const msg = body.error || body.message;
  const base =
    typeof msg === "string" && msg.trim()
      ? msg
      : `Worker request failed (${status})`;
  const trace =
    traceId ||
    (typeof body.traceId === "string" && body.traceId.trim()
      ? body.traceId.trim()
      : undefined);
  return trace ? `${base} (trace: ${trace})` : base;
}

/** Parse worker JSON with unknown-safe narrowing. */
export async function parseWorkerJson<T>(res: Response): Promise<T> {
  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errBody =
      body && typeof body === "object" ? (body as WorkerErrorBody) : {};
    throw new Error(
      readWorkerErrorMessage(errBody, res.status, readWorkerTraceId(res))
    );
  }
  return body as T;
}

export async function fetchWorkerJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);
  return parseWorkerJson<T>(res);
}

/** Worker fetch that throws on non-OK; returns the raw Response (e.g. blob downloads). */
export async function fetchWorker(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => ({}));
    const errBody =
      body && typeof body === "object" ? (body as WorkerErrorBody) : {};
    throw new Error(
      readWorkerErrorMessage(errBody, res.status, readWorkerTraceId(res))
    );
  }
  return res;
}

export function workerFetchErrorMessage(err: unknown, fallback: string): string {
  return messageFromUnknown(err, fallback);
}
