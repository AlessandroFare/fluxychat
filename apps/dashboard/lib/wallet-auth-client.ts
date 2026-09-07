import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface WalletNonceResponse {
  nonce: string;
  issuedAt: string;
  message: string;
  address: string;
}

export interface WalletMintResponse {
  token: string;
  expiresIn: number;
  userId: string;
  projectId: string;
}

export async function requestWalletNonce(token: string, address: string): Promise<WalletNonceResponse> {
  const url = new URL(`${BASE}/admin/auth/wallet/nonce`);
  url.searchParams.set("address", address);
  return fetchWorkerJson(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getWalletAllowlist(token: string): Promise<{ addresses: string[] }> {
  return fetchWorkerJson(`${BASE}/admin/auth/wallet/allowlist`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function saveWalletAllowlist(
  token: string,
  addresses: string[],
): Promise<{ addresses: string[] }> {
  return fetchWorkerJson(`${BASE}/admin/auth/wallet/allowlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ addresses }),
  });
}

export async function verifyWalletSiwe(
  token: string,
  body: { address: string; message: string; signature: string },
): Promise<WalletMintResponse> {
  return fetchWorkerJson(`${BASE}/admin/auth/wallet`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}
