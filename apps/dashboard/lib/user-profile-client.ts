import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface UserProfile {
  id: string;
  clerk_user_id: string;
  display_name: string | null;
  image_url: string | null;
  email: string | null;
  bio: string | null;
  status_emoji: string | null;
  status_text: string | null;
  status_expiration: number | null;
  created_at: string;
  updated_at: string;
}

export async function getProfile(token: string, userId: string): Promise<UserProfile> {
  return fetchWorkerJson<UserProfile>(
    `${BASE}/users/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function updateProfile(
  token: string,
  userId: string,
  body: {
    displayName?: string;
    bio?: string;
    imageUrl?: string;
    statusEmoji?: string | null;
    statusText?: string | null;
    statusExpiration?: number | null;
  },
): Promise<UserProfile> {
  return fetchWorkerJson<UserProfile>(
    `${BASE}/users/${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    },
  );
}
