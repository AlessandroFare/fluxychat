import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

function jsonHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

// ── Keyword alerts ──────────────────────────────────────────────────────

export interface NotificationKeywordItem {
  word: string;
  createdAt: string;
}

export async function listNotificationKeywords(
  token: string,
): Promise<NotificationKeywordItem[]> {
  const data = await fetchWorkerJson<{ keywords?: NotificationKeywordItem[] }>(
    `${BASE}/notification-keywords`,
    { headers: authHeaders(token) },
  );
  return Array.isArray(data.keywords) ? data.keywords : [];
}

export async function addNotificationKeyword(token: string, word: string): Promise<void> {
  await fetchWorkerJson(`${BASE}/notification-keywords`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({ word }),
  });
}

export async function removeNotificationKeyword(token: string, word: string): Promise<void> {
  await fetchWorkerJson(`${BASE}/notification-keywords/${encodeURIComponent(word)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

// ── User groups ─────────────────────────────────────────────────────────

export interface UserGroupItem {
  id: string;
  name: string;
  memberIds: string[];
  createdAt?: string;
}

export async function listUserGroups(token: string): Promise<UserGroupItem[]> {
  const data = await fetchWorkerJson<{ groups?: UserGroupItem[] }>(`${BASE}/user-groups`, {
    headers: authHeaders(token),
  });
  return Array.isArray(data.groups) ? data.groups : [];
}

export async function createUserGroup(
  token: string,
  input: { name: string; memberIds: string[] },
): Promise<UserGroupItem | null> {
  const data = await fetchWorkerJson<{ group?: UserGroupItem }>(`${BASE}/user-groups`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(input),
  });
  return data.group ?? null;
}

export async function deleteUserGroup(token: string, groupId: string): Promise<void> {
  await fetchWorkerJson(`${BASE}/user-groups/${encodeURIComponent(groupId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

// ── Custom emoji ────────────────────────────────────────────────────────

export interface CustomEmojiItem {
  id: string;
  name: string;
  imageUrl: string;
  createdAt?: string;
}

export async function listCustomEmojis(token: string): Promise<CustomEmojiItem[]> {
  const data = await fetchWorkerJson<{ emojis?: CustomEmojiItem[] }>(
    `${BASE}/custom-emojis`,
    { headers: authHeaders(token) },
  );
  return Array.isArray(data.emojis) ? data.emojis : [];
}

export async function createCustomEmoji(
  token: string,
  input: { name: string; imageUrl: string },
): Promise<CustomEmojiItem | null> {
  const data = await fetchWorkerJson<{ emoji?: CustomEmojiItem }>(`${BASE}/custom-emojis`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(input),
  });
  return data.emoji ?? null;
}

export async function deleteCustomEmoji(token: string, id: string): Promise<void> {
  await fetchWorkerJson(`${BASE}/custom-emojis/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}
