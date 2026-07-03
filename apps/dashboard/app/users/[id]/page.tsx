"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { ConsoleShell } from "@/app/components/console-shell";
import { ConsolePageHeader } from "@/app/components/console-page-header";
import { useDashboardSession } from "@/app/components/dashboard-session";
import { useClerkUser } from "@/lib/clerk-user";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";
import { isClerkClientConfigured } from "@/lib/hosted-product";
import { cn } from "@/lib/utils";
import { Banner, Button, EmptyState, Panel } from "../../components/ui";
import { ArrowLeft, Edit3, ExternalLink, RefreshCw, Save, User as UserIcon } from "lucide-react";

interface UserProfile {
  id: string;
  clerk_user_id: string | null;
  display_name: string | null;
  image_url: string | null;
  email: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export default function UserProfilePage() {
  const params = useParams<{ id: string }>();
  const userId = params.id;
  const { memberJwt, adminJwt } = useDashboardSession();
  const token = memberJwt.trim() || adminJwt.trim();
  const { user: clerkUser } = useClerkUser();
  const { openUserProfile } = useClerk();
  const WORKER_URL = getPublicWorkerUrl();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [imgKey, setImgKey] = useState(0); // forces <img> reload
  const [syncingFromClerk, setSyncingFromClerk] = useState(false);

  const myFluxyId = clerkUser?.id ? fluxyUserIdFromClerk(clerkUser.id) : null;
  const isMe = myFluxyId === userId;

  useEffect(() => {
    if (!token || !userId) return;
    setLoading(true);
    fetch(`${WORKER_URL}/users/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Failed: ${res.status}`);
        }
        return res.json();
      })
      .then((data: UserProfile) => {
        setProfile(data);
        setEditName(data.display_name || "");
        setEditBio(data.bio || "");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, userId, WORKER_URL]);

  // Sync current user to D1 on first load + when Clerk data changes
  const clerkImageUrl = clerkUser?.imageUrl;
  const clerkDisplayName = clerkUser?.fullName || clerkUser?.username;
  const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress;

  useEffect(() => {
    if (!token || !clerkUser?.id || !isClerkClientConfigured()) return;
    if (myFluxyId !== userId) return;
    setSyncingFromClerk(true);
    fetch(`${WORKER_URL}/users/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        clerkUserId: clerkUser.id,
        displayName: clerkDisplayName || null,
        imageUrl: clerkImageUrl || null,
        email: clerkEmail || null,
      }),
    })
      .then(() => {
        // Refresh profile from server to get updated image_url
        return fetch(`${WORKER_URL}/users/${encodeURIComponent(userId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      })
      .then((res) => res.json())
      .then((data: UserProfile) => {
        setProfile(data);
        setImgKey((k) => k + 1); // force img reload
      })
      .catch(() => {})
      .finally(() => setSyncingFromClerk(false));
  }, [token, clerkUser?.id, myFluxyId, userId, WORKER_URL, clerkImageUrl, clerkDisplayName, clerkEmail]);

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await fetchWorkerJson<UserProfile>(
        `${WORKER_URL}/users/${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            displayName: editName.trim(),
            bio: editBio.trim(),
          }),
        },
      );
      setProfile(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ConsoleShell className="max-w-2xl">
        <ConsolePageHeader title="User profile" description="Loading…" />
        <Panel className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-16 w-16 rounded-full bg-muted" />
            <div className="h-4 w-48 rounded bg-muted" />
            <div className="h-3 w-32 rounded bg-muted" />
          </div>
        </Panel>
      </ConsoleShell>
    );
  }

  if (error || !profile) {
    return (
      <ConsoleShell className="max-w-2xl">
        <ConsolePageHeader title="User profile" />
        <EmptyState
          icon={UserIcon}
          title="User not found"
          description={error || "This user doesn't have a profile yet."}
          action={{
            label: "Go back",
            onClick: () => window.history.back(),
          }}
        />
      </ConsoleShell>
    );
  }

  const displayName = profile.display_name || (profile.id.length > 12 ? profile.id.slice(0, 12) + "…" : profile.id);

  return (
    <ConsoleShell className="max-w-2xl">
      <ConsolePageHeader
        title="User profile"
        description={isMe ? "This is your profile." : undefined}
      />

      <Panel className="p-6">
        {/* Avatar + name */}
        <div className="flex items-start gap-4">
          <div className="size-20 shrink-0 overflow-hidden rounded-full bg-muted">
            {profile.image_url ? (
              <img
                key={imgKey}
                src={profile.image_url}
                alt={displayName}
                className="size-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-muted">
                <UserIcon className="size-8 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Display name"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Bio (optional)"
                  rows={3}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <Save className="mr-1 size-3.5" />
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-foreground">{displayName}</h2>
                {profile.email ? (
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                ) : null}
                {profile.bio ? (
                  <p className="mt-2 text-sm text-foreground">{profile.bio}</p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  Member since {new Date(profile.created_at).toLocaleDateString()}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Actions for self */}
        {isMe && !editing ? (
          <div className="mt-6 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Edit3 className="mr-1.5 size-3.5" />
              Edit profile
            </Button>
            {isClerkClientConfigured() ? (
              <Button size="sm" variant="outline" onClick={() => openUserProfile()}>
                <ExternalLink className="mr-1.5 size-3.5" />
                Manage on Clerk
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setImgKey((k) => k + 1)}
              disabled={syncingFromClerk}
            >
              <RefreshCw className={cn("mr-1.5 size-3.5", syncingFromClerk && "animate-spin")} />
              Refresh
            </Button>
          </div>
        ) : null}
      </Panel>

      <div className="mt-4">
        <Button size="sm" variant="ghost" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-1.5 size-3.5" />
          Back
        </Button>
      </div>
    </ConsoleShell>
  );
}
