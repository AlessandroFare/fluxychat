"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FluxyChatClient, type FluxyChatRoom } from "@fluxy-chat/sdk";
import { createMemberFluxyClient } from "@/lib/fluxy-member-client";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConfirmDialog } from "../components/confirm-dialog";
import { useClerkUser } from "@/lib/clerk-user";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";
import { readJwtSub } from "@/lib/jwt-claims";
import { RoomTypeSelect } from "../components/room-type-select";
import { isRoomType } from "@/lib/room-types";
import { Banner, Button, Input, Section } from "../components/ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { messageFromUnknown } from "@/lib/error-message";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { AssistantRoomPanel } from "../components/assistant-room-panel";
import { RoomHealthCard } from "../components/room-health-card";
import { RoomScheduledCompose } from "../components/room-scheduled-compose";
import { FluxyChat } from "@/components/chat";
import { provisionDecisionRoomPack } from "@/lib/decision-rooms-client";
import { provisionEnterpriseAgentRoom } from "@/lib/enterprise-agent-room-client";
import dynamic from "next/dynamic";

const RoomAdvancedPanels = dynamic(
  () => import("./room-advanced-panels").then((m) => m.RoomAdvancedPanels),
  { ssr: false, loading: () => <p className="text-sm text-muted-foreground">Loading advanced…</p> },
);

const WORKER_URL = getPublicWorkerUrl();

export default function RoomsPage() {
  const searchParams = useSearchParams();
  const roomFromQuery = searchParams.get("room")?.trim() || null;
  const messageIdFromQuery = Number(searchParams.get("messageId")) || undefined;
  const { adminJwt, memberJwt, activeProject } = useDashboardSession();
  const { user: clerkUser } = useClerkUser();
  const memberToken = memberJwt.trim();
  const fluxyMemberUserId =
    (clerkUser?.id ? fluxyUserIdFromClerk(clerkUser.id) : null) ??
    readJwtSub(memberToken) ??
    "";
  const token = (adminJwt || memberJwt).trim();
  /** Prefer member JWT for listing — matches quickstart; admin still used for mutations when needed. */
  const listToken = (memberJwt || adminJwt).trim();
  const [rooms, setRooms] = useState<(FluxyChatRoom & { unreadCount?: number })[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roomTab, setRoomTab] = useState<"chat" | "members" | "advanced">("chat");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("group");
  const [creating, setCreating] = useState(false);
  const [creatingDecisionRoom, setCreatingDecisionRoom] = useState(false);
  const [creatingEnterpriseRoom, setCreatingEnterpriseRoom] = useState(false);

  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const [memberUserId, setMemberUserId] = useState("");
  const [memberBusy, setMemberBusy] = useState(false);
  const [memberListKey, setMemberListKey] = useState(0);

  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [deleteRoomOpen, setDeleteRoomOpen] = useState(false);

  const client = useMemo(
    () =>
      new FluxyChatClient({
        baseUrl: WORKER_URL,
        userId: "dashboard",
        token: token || undefined,
      }),
    [token]
  );

  const listClient = useMemo(
    () =>
      new FluxyChatClient({
        baseUrl: WORKER_URL,
        userId: "dashboard",
        token: listToken || undefined,
      }),
    [listToken]
  );

  const adminClient = useMemo(
    () =>
      new FluxyChatClient({
        baseUrl: WORKER_URL,
        userId: "dashboard-admin",
        token: adminJwt.trim() || undefined,
      }),
    [adminJwt]
  );

  const chatClient = useMemo(
    () =>
      createMemberFluxyClient({
        memberJwt: memberToken,
        memberUserId: fluxyMemberUserId || undefined,
        clerkUserId: clerkUser?.id ?? null,
      }),
    [memberToken, fluxyMemberUserId, clerkUser?.id],
  );

  const loadRooms = useCallback(async () => {
    if (!listToken) {
      setError("JWT required (member or admin from Projects / Onboarding).");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const list = await listClient.listRooms();
      setRooms(list);
      setNotice(`Loaded ${list.length} rooms.`);
      setSelectedId((prev) => {
        if (prev && list.some((r) => r.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e: unknown) {
      setError(messageFromUnknown(e, "Failed to load rooms"));
    } finally {
      setLoading(false);
    }
  }, [listClient, listToken]);

  useEffect(() => {
    if (!listToken) return;
    void loadRooms();
  }, [listToken, loadRooms]);

  useEffect(() => {
    if (!roomFromQuery) return;
    setSelectedId(roomFromQuery);
  }, [roomFromQuery]);

  const createRoom = async () => {
    if (!token || !newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const roomType = isRoomType(newType) ? newType : "group";
      await client.createRoom({
        name: newName.trim(),
        type: roomType,
      });
      setNewName("");
      setNotice("Room created.");
      await loadRooms();
    } catch (e: unknown) {
      setError(messageFromUnknown(e, "Create failed"));
    } finally {
      setCreating(false);
    }
  };

  const createDecisionRoom = async () => {
    const patchToken = adminJwt.trim();
    if (!patchToken) {
      setError("Decision Rooms pack requires an admin JWT.");
      return;
    }
    const name = newName.trim() || "Decision Room";
    setCreatingDecisionRoom(true);
    setError(null);
    try {
      const result = await provisionDecisionRoomPack(patchToken, name);
      setNewName("");
      setNotice(
        `Decision Room created (${result.templatesCreated} templates seeded). Open ${result.room.id}`,
      );
      setSelectedId(result.room.id);
      await loadRooms();
    } catch (e: unknown) {
      setError(messageFromUnknown(e, "Decision Room creation failed"));
    } finally {
      setCreatingDecisionRoom(false);
    }
  };

  const createEnterpriseAgentRoom = async () => {
    const patchToken = adminJwt.trim();
    if (!patchToken) {
      setError("Enterprise Agent Room requires an admin JWT.");
      return;
    }
    const name = newName.trim() || "Enterprise Agent Room";
    setCreatingEnterpriseRoom(true);
    setError(null);
    try {
      const result = await provisionEnterpriseAgentRoom(patchToken, name);
      setNewName("");
      setNotice(`Enterprise Agent Room created: ${result.room.id}`);
      setSelectedId(result.room.id);
      await loadRooms();
    } catch (e: unknown) {
      setError(messageFromUnknown(e, "Enterprise room creation failed"));
    } finally {
      setCreatingEnterpriseRoom(false);
    }
  };

  const saveRoom = async () => {
    if (!selectedId || !editName.trim()) return;
    const patchToken = adminJwt.trim();
    if (!patchToken) {
      setError("Renaming a room needs an admin JWT (from Quickstart or Projects → Session).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await fetchWorkerJson<{ ok?: boolean }>(
        `${WORKER_URL}/rooms/${encodeURIComponent(selectedId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${patchToken}`,
          },
          body: JSON.stringify({ name: editName.trim() }),
        },
      );
      setNotice("Room updated.");
      await loadRooms();
    } catch (e: unknown) {
      setError(messageFromUnknown(e, "Update failed"));
    } finally {
      setSaving(false);
    }
  };

  const deleteRoomConfirmed = async () => {
    if (!token || !selectedId) return;
    setError(null);
    try {
      await client.deleteRoom(selectedId);
      setNotice("Room deleted.");
      setSelectedId(null);
      setEditName("");
      await loadRooms();
    } catch (e: unknown) {
      setError(messageFromUnknown(e, "Delete failed"));
    }
  };

  const removeMemberConfirmed = async (userId: string) => {
    if (!token || !selectedId || !adminJwt.trim()) return;
    setMemberBusy(true);
    setError(null);
    try {
      const c = new FluxyChatClient({
        baseUrl: WORKER_URL,
        userId: "dashboard",
        token: adminJwt.trim(),
      });
      await c.removeRoomMember(selectedId, userId);
      setNotice("Member removed.");
      setMemberListKey((k) => k + 1);
    } catch (e: unknown) {
      setError(messageFromUnknown(e, "Remove member failed"));
    } finally {
      setMemberBusy(false);
      setMemberToRemove(null);
    }
  };

  const addMember = async () => {
    if (!token || !selectedId || !memberUserId.trim()) return;
    if (!adminJwt.trim()) {
      setError("Adding members requires admin JWT (owner/admin role).");
      return;
    }
    setMemberBusy(true);
    setError(null);
    try {
      const c = new FluxyChatClient({
        baseUrl: WORKER_URL,
        userId: "dashboard",
        token: adminJwt.trim(),
      });
      await c.addRoomMember(selectedId, memberUserId.trim(), "member");
      setMemberUserId("");
      setNotice("Member added.");
      setMemberListKey((k) => k + 1);
    } catch (e: unknown) {
      setError(messageFromUnknown(e, "Add member failed"));
    } finally {
      setMemberBusy(false);
    }
  };

  const selected = rooms.find((r) => r.id === selectedId);

  React.useEffect(() => {
    if (selected) setEditName(selected.name || "");
  }, [selected?.id, selected?.name]);

  return (
    <ConsoleShell>
      <ConsolePageHeader
        description={
          <>
            Create, rename, and delete rooms. Members need an admin JWT. Project:{" "}
            <code>{activeProject?.name || "none"}</code>
          </>
        }
      />
      {error ? <Banner variant="error">Error: {error}</Banner> : null}
      {notice ? <Banner variant="success">{notice}</Banner> : null}

      <AssistantRoomPanel
        memberJwt={memberJwt}
        adminJwt={adminJwt}
        projectId={activeProject?.id ?? ""}
        client={chatClient}
      />

      <Section title="Session">
        <Button onClick={loadRooms} disabled={loading || !token}>
          {loading ? "Loading…" : "Load rooms"}
        </Button>
      </Section>

      <div id="create-room-form">
        <Section
          title="Create a room"
          description="Pick a name and a type. Public rooms anyone with the link can join; group rooms are invitation-only."
        >
        <div className="grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_minmax(10rem,auto)_auto] sm:items-end">
          <div>
            <label htmlFor="new-room-name" className="mb-1 block text-xs font-medium text-muted-foreground">
              Display name
            </label>
            <Input
              id="new-room-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. support"
            />
          </div>
          <RoomTypeSelect value={newType} onChange={setNewType} disabled={creating || !token} className="gap-1" />
          <Button
            variant="primary"
            onClick={createRoom}
            disabled={creating || !newName.trim() || !token}
          >
            {creating ? "Creating…" : "Create"}
          </Button>
          <Button
            variant="outline"
            onClick={() => void createDecisionRoom()}
            disabled={creatingDecisionRoom || !adminJwt.trim()}
            title="Quorum, debate, counterfactual replay, and Truth Market preset"
          >
            {creatingDecisionRoom ? "Creating…" : "Create Decision Room"}
          </Button>
          <Button
            variant="outline"
            onClick={() => void createEnterpriseAgentRoom()}
            disabled={creatingEnterpriseRoom || !adminJwt.trim()}
            title="Multi-agent room with audit trail and cross-org flows"
          >
            {creatingEnterpriseRoom ? "Creating…" : "Enterprise Agent Room"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          <strong>Decision Room</strong> seeds templates and links{" "}
          <a href="/agents/debate" className="text-primary underline">debate</a> +{" "}
          <a href="/truth-market" className="text-primary underline">Truth Market</a>.{" "}
          <strong>Enterprise Agent Room</strong> bundles multi-agent RBAC,{" "}
          <a href="/audit-chain" className="text-primary underline">audit chain</a>, and{" "}
          <a href="/agents/cross-org" className="text-primary underline">cross-org</a> flows.
        </p>
        </Section>
      </div>

      <section className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr] lg:items-start">
        <div className="rounded-xl bg-white/90 p-4 shadow-[var(--shadow-2)] backdrop-blur-sm">
          <h2 className="font-heading mb-2 text-lg font-semibold text-foreground">Your rooms</h2>
          {rooms.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-3">
              <p className="text-sm font-medium text-foreground">No rooms yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Create your first room to start chatting. Each room holds its own history and members.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  // Scroll to the create form (it's the first card in the page).
                  document
                    .getElementById("create-room-form")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Create a room
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {rooms.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={[
                    "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    selectedId === r.id
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border bg-muted/30 text-foreground hover:bg-muted/50",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{r.name}</span>
                    {typeof r.unreadCount === "number" && r.unreadCount > 0 ? (
                      <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        {r.unreadCount > 99 ? "99+" : r.unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {r.id} · {r.type}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white/90 p-4 shadow-[var(--shadow-2)] backdrop-blur-sm">
          {!selectedId ? (
            <p className="text-muted-foreground">Select a room.</p>
          ) : (
            <>
              <h2 className="font-heading mb-3 text-lg font-semibold text-foreground">Edit room</h2>
              <div className="mb-3 flex flex-wrap gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Name"
                  style={{ flex: "1 1 200px" }}
                />
                <Button onClick={saveRoom} disabled={saving || !editName.trim()}>
                  {saving ? "Saving…" : "Save name"}
                </Button>
                <Button
                  onClick={() => setDeleteRoomOpen(true)}
                  disabled={!adminJwt.trim()}
                  variant="destructive"
                  size="sm"
                >
                  Delete room
                </Button>
              </div>
              {!adminJwt.trim() ? (
                <p className="mb-2 text-xs text-amber-500">
                  Delete / manage members requires admin JWT in Projects.
                </p>
              ) : null}

              <div className="mb-4 flex gap-1 rounded-lg border border-border p-1">
                {(["chat", "members", "advanced"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setRoomTab(tab)}
                    className={[
                      "flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize",
                      roomTab === tab ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50",
                    ].join(" ")}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {roomTab === "members" ? (
                <>
              <h3 className="mb-2 mt-2 text-sm font-semibold">Members</h3>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <Input
                  value={memberUserId}
                  onChange={(e) => setMemberUserId(e.target.value)}
                  placeholder="userId to add"
                />
                <Button onClick={addMember} disabled={memberBusy || !memberUserId.trim()}>
                  Add
                </Button>
              </div>
              <MemberList
                key={`${selectedId}-${memberListKey}`}
                roomId={selectedId}
                adminJwt={adminJwt.trim()}
                onRemove={(uid) => setMemberToRemove(uid)}
                memberBusy={memberBusy}
              />
                </>
              ) : null}

              {roomTab === "chat" ? (
                <>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => {
                    const url = `${window.location.origin}/agents?room=${encodeURIComponent(selectedId)}&replay=1&replayLimit=100`;
                    void navigator.clipboard?.writeText(url);
                    setNotice("Replay deep link copied.");
                  }}
                >
                  Copy replay link
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={!adminClient.isAuthenticated()}
                  title={!adminJwt.trim() ? "Admin JWT required (owner/admin/moderator role)" : undefined}
                  onClick={async () => {
                    try {
                      const pack = await adminClient.getRoomComplianceExport(selectedId);
                      const blob = new Blob([JSON.stringify(pack, null, 2)], {
                        type: "application/json",
                      });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `fluxy-compliance-${selectedId}.json`;
                      a.click();
                      setNotice("Compliance pack downloaded.");
                    } catch (e: unknown) {
                      setError(messageFromUnknown(e, "Export failed"));
                    }
                  }}
                >
                  Compliance export
                </Button>
              </div>

              {listClient.isAuthenticated() ? (
                <div className="mt-6 space-y-4">
                  <RoomHealthCard client={listClient} roomId={selectedId} />
                  <RoomScheduledCompose client={listClient} roomId={selectedId} />
                </div>
              ) : null}

              {chatClient?.isAuthenticated() ? (
                <div className="mt-6">
                  <h3 className="mb-2 text-sm font-semibold">Live chat</h3>
                  <div className="min-h-[24rem] rounded-lg border border-border">
                    <FluxyChat
                      roomId={selectedId}
                      client={chatClient}
                      scrollToMessageId={messageIdFromQuery}
                      variant="minimal"
                    />
                  </div>
                </div>
              ) : null}
                </>
              ) : null}

              {roomTab === "advanced" ? (
                memberToken ? (
                  <RoomAdvancedPanels
                    roomId={selectedId}
                    memberJwt={memberToken}
                    memberUserId={fluxyMemberUserId || undefined}
                  />
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Add a member JWT in Quickstart to configure advanced room modules.
                  </p>
                )
              ) : null}
            </>
          )}
        </div>
      </section>
      <ConfirmDialog
        open={deleteRoomOpen}
        onOpenChange={setDeleteRoomOpen}
        title="Delete this room?"
        description="All messages in this room will be deleted. This cannot be undone."
        confirmLabel="Delete room"
        variant="destructive"
        onConfirm={() => void deleteRoomConfirmed()}
      />
      <ConfirmDialog
        open={memberToRemove !== null}
        onOpenChange={(open) => {
          if (!open) setMemberToRemove(null);
        }}
        title="Remove member?"
        description={
          memberToRemove
            ? `Remove ${memberToRemove} from this room?`
            : undefined
        }
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => {
          if (memberToRemove) void removeMemberConfirmed(memberToRemove);
        }}
      />
    </ConsoleShell>
  );
}

function MemberList({
  roomId,
  adminJwt,
  onRemove,
  memberBusy,
}: {
  roomId: string;
  adminJwt: string;
  onRemove: (userId: string) => void;
  memberBusy: boolean;
}) {
  const [members, setMembers] = useState<{ userId: string; role: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const adminClient = useMemo(
    () =>
      new FluxyChatClient({
        baseUrl: WORKER_URL,
        userId: "dashboard",
        token: adminJwt,
      }),
    [adminJwt],
  );

  const load = useCallback(async () => {
    if (!adminJwt) return;
    setLoading(true);
    try {
      const list = await adminClient.fetchRoomMembers(roomId);
      setMembers(list);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [adminClient, adminJwt, roomId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (!adminJwt) {
    return (
      <p className="text-xs text-muted-foreground">
        Set admin JWT to load members.
      </p>
    );
  }
  if (loading) return <p className="text-sm text-muted-foreground">Loading members…</p>;
  if (members.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-3">
        <p className="text-sm font-medium text-foreground">No members yet</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Add people by their userId above. They can also join public rooms via an invite link.
        </p>
      </div>
    );
  }

  return (
    <ul className="list-none p-0 m-0">
      {members.map((m) => (
        <li
          key={m.userId}
          className="flex items-center justify-between border-b border-border py-1.5 text-sm"
        >
          <span>
            <code>{m.userId}</code> · {m.role}
          </span>
          <button
            type="button"
            disabled={memberBusy}
            onClick={() => onRemove(m.userId)}
            className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-800 disabled:cursor-not-allowed"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

