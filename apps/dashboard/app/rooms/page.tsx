"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FluxyChatClient, type FluxyChatRoom } from "@fluxy-chat/sdk";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConfirmDialog } from "../components/confirm-dialog";
import { RoomTypeSelect } from "../components/room-type-select";
import { isRoomType } from "@/lib/room-types";
import { Banner, Button, Input, Section } from "../components/ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { messageFromUnknown } from "@/lib/error-message";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const WORKER_URL = getPublicWorkerUrl();

export default function RoomsPage() {
  const { adminJwt, memberJwt, activeProject } = useDashboardSession();
  const token = (adminJwt || memberJwt).trim();
  /** Prefer member JWT for listing — matches quickstart; admin still used for mutations when needed. */
  const listToken = (memberJwt || adminJwt).trim();
  const [rooms, setRooms] = useState<FluxyChatRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("group");
  const [creating, setCreating] = useState(false);

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

      <Section title="Session">
        <Button onClick={loadRooms} disabled={loading || !token}>
          {loading ? "Loading…" : "Load rooms"}
        </Button>
      </Section>

      <Section title="Create room" description="Name is shown in the UI; type controls join and visibility rules on the Worker.">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
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
          <RoomTypeSelect value={newType} onChange={setNewType} disabled={creating || !token} />
          <Button
            variant="primary"
            onClick={createRoom}
            disabled={creating || !newName.trim() || !token}
          >
            {creating ? "Creating…" : "Create"}
          </Button>
        </div>
      </Section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          gap: 16,
          alignItems: "start",
          marginTop: 16,
        }}
      >
        <div className="rounded-xl border border-black/[0.06] bg-white/90 p-4 shadow-[var(--shadow-subtle-2)] backdrop-blur-sm">
          <h2 className="font-heading mb-2 text-lg font-semibold text-foreground">Your rooms</h2>
          {rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rooms loaded.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
                  <div className="font-semibold">{r.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {r.id} · {r.type}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-black/[0.06] bg-white/90 p-4 shadow-[var(--shadow-subtle-2)] backdrop-blur-sm">
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

              <h3 className="mb-2 mt-4 text-sm font-semibold">Members</h3>
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
  if (members.length === 0) return <p className="text-sm text-muted-foreground">No members or empty.</p>;

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
