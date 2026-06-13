import { computeReconnectBackoffMs } from './errors';

export type FluxyChatTransport = 'websocket' | 'sse' | 'polling' | 'none';
export type FluxyConnectionStateStatus = 'connected' | 'connecting' | 'reconnecting' | 'polling' | 'sse' | 'disconnected';

export interface FluxyConnectionState {
  status: FluxyConnectionStateStatus;
  lastError: Error | null;
  retryAttempt: number;
  nextRetryAt: string | null;
  transport: FluxyChatTransport;
}

export interface BuildFluxyConnectionStateInput {
  status: FluxyConnectionStateStatus;
  lastError?: Error | null;
  retryAttempt?: number;
  reconnectDelayMs?: number | null;
  transport?: FluxyChatTransport;
  nowMs?: number;
}

export function buildFluxyConnectionState(input: BuildFluxyConnectionStateInput): FluxyConnectionState {
  const nowMs = input.nowMs ?? Date.now();
  const retryAttempt = input.retryAttempt ?? 0;
  let nextRetryAt: string | null = null;

  if (input.status === 'reconnecting') {
    const delay = input.reconnectDelayMs ?? computeReconnectBackoffMs(Math.max(retryAttempt, 1));
    if (delay > 0) nextRetryAt = new Date(nowMs + delay).toISOString();
  }

  return {
    status: input.status,
    lastError: input.lastError ?? null,
    retryAttempt,
    nextRetryAt,
    transport: input.transport ?? transportFromStatus(input.status),
  };
}

function transportFromStatus(status: FluxyConnectionStateStatus): FluxyChatTransport {
  if (status === 'sse') return 'sse';
  if (status === 'polling') return 'polling';
  if (status === 'connected' || status === 'connecting' || status === 'reconnecting') return 'websocket';
  return 'none';
}
