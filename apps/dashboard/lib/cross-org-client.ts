import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export interface CrossOrgRoom {
  id: string;
  projectId: string;
  roomId: string;
  name: string;
  orgAId: string;
  orgBId: string;
  orgAAgentId: string | null;
  orgBAgentId: string | null;
  maxRounds: number;
  status: string;
  createdAt: string;
  createdBy: string;
}

export interface CrossOrgCommitment {
  id: string;
  crossOrgRoomId: string;
  roomId: string;
  proposedByOrg: string;
  proposedByAgent: string | null;
  terms: Record<string, unknown>;
  state: string;
  roundNumber: number;
  humanAConfirmedAt: string | null;
  humanBConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listCrossOrgRooms(token: string): Promise<{ rooms: CrossOrgRoom[] }> {
  return fetchWorkerJson(`${BASE}/cross-org/rooms`, { headers: authHeaders(token) });
}

export async function createCrossOrgRoom(
  token: string,
  body: {
    name: string;
    orgAId: string;
    orgBId: string;
    orgAAgentId?: string;
    orgBAgentId?: string;
    maxRounds?: number;
  },
): Promise<{ ok: boolean; room: CrossOrgRoom }> {
  return fetchWorkerJson(`${BASE}/cross-org/rooms`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function registerCrossOrgAgent(
  token: string,
  crossOrgRoomId: string,
  body: {
    orgId: string;
    agentId: string;
    publicKeyB64: string;
    capabilities?: string[];
    card?: Record<string, unknown>;
  },
): Promise<{ ok: boolean }> {
  return fetchWorkerJson(`${BASE}/cross-org/rooms/${encodeURIComponent(crossOrgRoomId)}/agents`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listCrossOrgCommitments(
  token: string,
  crossOrgRoomId: string,
): Promise<{ commitments: CrossOrgCommitment[] }> {
  return fetchWorkerJson(
    `${BASE}/cross-org/rooms/${encodeURIComponent(crossOrgRoomId)}/commitments`,
    { headers: authHeaders(token) },
  );
}

export async function proposeCrossOrgCommitment(
  token: string,
  crossOrgRoomId: string,
  body: { proposedByOrg: string; proposedByAgent?: string; terms: Record<string, unknown> },
): Promise<{ ok: boolean; commitment: CrossOrgCommitment }> {
  return fetchWorkerJson(
    `${BASE}/cross-org/rooms/${encodeURIComponent(crossOrgRoomId)}/commitments`,
    {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

export async function counterCrossOrgCommitment(
  token: string,
  commitmentId: string,
  body: {
    counterByOrg: string;
    terms: Record<string, unknown>;
    proposedByAgent?: string;
  },
): Promise<{ ok: boolean; commitment: CrossOrgCommitment }> {
  return fetchWorkerJson(
    `${BASE}/cross-org/commitments/${encodeURIComponent(commitmentId)}/counter`,
    {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

export async function approveCrossOrgCommitment(
  token: string,
  commitmentId: string,
  orgId: string,
): Promise<{ ok: boolean; commitment: CrossOrgCommitment }> {
  return fetchWorkerJson(
    `${BASE}/cross-org/commitments/${encodeURIComponent(commitmentId)}/approve`,
    {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    },
  );
}

export async function listCrossOrgAudit(
  token: string,
  crossOrgRoomId: string,
): Promise<{ entries: Array<{ eventHash: string; event: Record<string, unknown> }> }> {
  return fetchWorkerJson(
    `${BASE}/cross-org/rooms/${encodeURIComponent(crossOrgRoomId)}/audit`,
    { headers: authHeaders(token) },
  );
}
