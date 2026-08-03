import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson, fetchWorker } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface SamlConfigResponse {
  configured: boolean;
  idp_entity_id?: string;
  idp_sso_url?: string;
  sp_entity_id?: string;
  sp_acs_url?: string;
  name_id_format?: string;
  attribute_mapping?: Record<string, string>;
  enabled?: boolean;
}

export interface SamlConfigInput {
  idp_entity_id: string;
  idp_sso_url: string;
  idp_certificate: string;
  sp_entity_id?: string;
  sp_acs_url: string;
  name_id_format?: string;
  attribute_mapping?: Record<string, string>;
  enabled?: boolean;
}

export interface ScimTokenRow {
  id: string;
  project_id: string;
  description: string | null;
  scopes: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface CreateScimTokenResult {
  id: string;
  token: string;
  description: string | null;
  created_at: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function getSamlConfig(token: string): Promise<SamlConfigResponse> {
  return fetchWorkerJson<SamlConfigResponse>(`${BASE}/saml/config`, {
    headers: authHeaders(token),
  });
}

export async function saveSamlConfig(token: string, body: SamlConfigInput): Promise<{ ok: boolean; id: string }> {
  return fetchWorkerJson(`${BASE}/saml/config`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function fetchSamlMetadata(token: string): Promise<string> {
  const res = await fetchWorker(`${BASE}/saml/metadata`, {
    headers: authHeaders(token),
  });
  return res.text();
}

export async function listScimTokens(token: string): Promise<{ tokens: ScimTokenRow[] }> {
  return fetchWorkerJson(`${BASE}/admin/scim/tokens`, {
    headers: authHeaders(token),
  });
}

export async function createScimToken(
  token: string,
  description: string,
  scopes?: string,
): Promise<CreateScimTokenResult> {
  return fetchWorkerJson(`${BASE}/admin/scim/tokens`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ description, scopes: scopes ?? "users,groups" }),
  });
}

export async function deleteScimToken(token: string, tokenId: string): Promise<void> {
  await fetchWorker(`${BASE}/admin/scim/tokens/${encodeURIComponent(tokenId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export function scimUsersEndpoint(projectId: string): string {
  return `${BASE}/scim/v2/Users?projectId=${encodeURIComponent(projectId)}`;
}

export function scimGroupsEndpoint(projectId: string): string {
  return `${BASE}/scim/v2/Groups?projectId=${encodeURIComponent(projectId)}`;
}

export interface PasskeyCredentialRow {
  id: number;
  credentialId: string;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  transports: string[];
}

export async function listPasskeyCredentials(token: string): Promise<{ credentials: PasskeyCredentialRow[] }> {
  return fetchWorkerJson(`${BASE}/webauthn/credentials`, {
    headers: authHeaders(token),
  });
}

export async function deletePasskeyCredential(token: string, credentialId: number): Promise<void> {
  await fetchWorker(`${BASE}/webauthn/credentials/${credentialId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function startPasskeyRegistration(token: string, displayName?: string): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const data = await fetchWorkerJson<{ options: PublicKeyCredentialCreationOptionsJSON }>(
    `${BASE}/webauthn/register/options`,
    {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(displayName ? { displayName } : {}),
    },
  );
  return data.options;
}

export async function finishPasskeyRegistration(
  token: string,
  response: RegistrationResponseJSON,
): Promise<{ ok: boolean; credentialId?: string }> {
  return fetchWorkerJson(`${BASE}/webauthn/register/verify`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ response }),
  });
}

export type PublicKeyCredentialCreationOptionsJSON = import("@simplewebauthn/browser").PublicKeyCredentialCreationOptionsJSON;
export type RegistrationResponseJSON = import("@simplewebauthn/browser").RegistrationResponseJSON;
