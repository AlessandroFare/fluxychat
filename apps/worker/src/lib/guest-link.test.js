import { describe, expect, it } from "vitest";
import { linkGuestToAccount } from "./guest-link.js";

function createDb({ rooms = [], members = [], links = [], onBatch = null } = {}) {
  const state = { rooms, members, links, batchCalls: 0 };
  const db = {
    state,
    prepare(sql) {
      const stmt = {
        sql,
        params: [],
        bind(...params) {
          stmt.params = params;
          return stmt;
        },
        async first() {
          if (sql.includes("FROM guest_links")) {
            const [projectId, guestUserId] = stmt.params;
            const row = state.links.find(
              (l) => l.project_id === projectId && l.guest_user_id === guestUserId,
            );
            return row ? { target_user_id: row.target_user_id } : null;
          }
          return null;
        },
        async all() {
          if (sql.includes("FROM room_members") && sql.includes("JOIN rooms")) {
            const [userId, projectId] = stmt.params;
            const projectRooms = new Set(
              state.rooms.filter((r) => r.project_id === projectId).map((r) => r.id),
            );
            return {
              results: state.members
                .filter((m) => m.user_id === userId && projectRooms.has(m.room_id))
                .map((m) => ({ room_id: m.room_id, role: m.role })),
            };
          }
          return { results: [] };
        },
        async run() {
          return { meta: {} };
        },
      };
      return stmt;
    },
    async batch(statements) {
      state.batchCalls += 1;
      if (onBatch) return onBatch(state);
      for (const stmt of statements) {
        if (stmt.sql.includes("UPDATE room_members")) {
          const [targetUserId, guestUserId, ...roomIds] = stmt.params;
          for (const member of state.members) {
            if (member.user_id === guestUserId && roomIds.includes(member.room_id)) {
              member.user_id = targetUserId;
              if (member.role === "guest") member.role = "member";
            }
          }
        } else if (stmt.sql.includes("DELETE FROM room_members")) {
          const [guestUserId, ...roomIds] = stmt.params;
          state.members = state.members.filter(
            (m) => !(m.user_id === guestUserId && roomIds.includes(m.room_id)),
          );
        } else if (stmt.sql.includes("INSERT INTO guest_links")) {
          const [project_id, guest_user_id, target_user_id, linked_at] = stmt.params;
          state.links.push({ project_id, guest_user_id, target_user_id, linked_at });
        }
      }
    },
  };
  return db;
}

function createVerify(tokens) {
  return async (request, _env, opts = {}) => {
    const header = request.headers.get("Authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const payload = tokens[token];
    if (!payload) throw new Response("Invalid token", { status: 401 });
    if (opts.expectedProjectId && payload.projectId !== opts.expectedProjectId) {
      throw new Response("Unauthorized", { status: 401 });
    }
    return payload;
  };
}

const GUEST_TOKEN = "guest.jwt";
const GUEST_TOKENS = { [GUEST_TOKEN]: { userId: "u_guest", projectId: "p1", roles: ["guest"] } };

function createEnv(db) {
  return { DB: db };
}

describe("linkGuestToAccount", () => {
  it("moves memberships to the target and upgrades the guest role", async () => {
    const db = createDb({
      rooms: [
        { id: "r1", project_id: "p1" },
        { id: "r2", project_id: "p1" },
        { id: "r3", project_id: "p1" },
        { id: "r_other", project_id: "p2" },
      ],
      members: [
        { room_id: "r1", user_id: "u_guest", role: "guest" },
        { room_id: "r2", user_id: "u_guest", role: "guest" },
        { room_id: "r_other", user_id: "u_guest", role: "guest" },
        { room_id: "r3", user_id: "u_target", role: "member" },
      ],
    });
    const result = await linkGuestToAccount(
      createEnv(db),
      { verifyJwtAndGetContext: createVerify(GUEST_TOKENS) },
      { projectId: "p1", targetUserId: "u_target", targetRoles: ["member"], guestToken: GUEST_TOKEN },
    );

    expect(result).toMatchObject({
      ok: true,
      status: 200,
      body: { guestUserId: "u_guest", targetUserId: "u_target", roomsTransferred: 2, roomsAlreadyMember: 0 },
    });
    const movedRooms = db.state.members
      .filter((m) => m.user_id === "u_target")
      .map((m) => m.room_id)
      .sort();
    expect(movedRooms).toEqual(["r1", "r2", "r3"]);
    expect(db.state.members.find((m) => m.room_id === "r1").role).toBe("member");
    // The guest keeps only the other project's membership (out of scope).
    expect(db.state.members.filter((m) => m.user_id === "u_guest").map((m) => m.room_id)).toEqual([
      "r_other",
    ]);
    expect(db.state.links).toHaveLength(1);
    expect(db.state.links[0]).toMatchObject({
      project_id: "p1",
      guest_user_id: "u_guest",
      target_user_id: "u_target",
    });
  });

  it("drops guest rows for rooms the target is already in", async () => {
    const db = createDb({
      rooms: [
        { id: "r1", project_id: "p1" },
        { id: "r2", project_id: "p1" },
      ],
      members: [
        { room_id: "r1", user_id: "u_guest", role: "guest" },
        { room_id: "r2", user_id: "u_guest", role: "guest" },
        { room_id: "r2", user_id: "u_target", role: "member" },
      ],
    });
    const result = await linkGuestToAccount(
      createEnv(db),
      { verifyJwtAndGetContext: createVerify(GUEST_TOKENS) },
      { projectId: "p1", targetUserId: "u_target", targetRoles: ["member"], guestToken: GUEST_TOKEN },
    );

    expect(result.body).toMatchObject({ roomsTransferred: 1, roomsAlreadyMember: 1 });
    expect(db.state.members).toEqual([
      { room_id: "r1", user_id: "u_target", role: "member" },
      { room_id: "r2", user_id: "u_target", role: "member" },
    ]);
  });

  it("rejects a missing or invalid guest token", async () => {
    const db = createDb();
    const deps = { verifyJwtAndGetContext: createVerify(GUEST_TOKENS) };

    const missing = await linkGuestToAccount(createEnv(db), deps, {
      projectId: "p1",
      targetUserId: "u_target",
      targetRoles: ["member"],
    });
    expect(missing).toMatchObject({ ok: false, status: 400, body: { error: "guest_token_required" } });

    const invalid = await linkGuestToAccount(createEnv(db), deps, {
      projectId: "p1",
      targetUserId: "u_target",
      targetRoles: ["member"],
      guestToken: "forged.jwt",
    });
    expect(invalid).toMatchObject({ ok: false, status: 400, body: { error: "invalid_guest_token" } });
    expect(db.state.batchCalls).toBe(0);
  });

  it("rejects a member token presented as the guest proof", async () => {
    const db = createDb();
    const tokens = { "member.jwt": { userId: "u_member", projectId: "p1", roles: ["member"] } };
    const result = await linkGuestToAccount(
      createEnv(db),
      { verifyJwtAndGetContext: createVerify(tokens) },
      { projectId: "p1", targetUserId: "u_target", targetRoles: ["member"], guestToken: "member.jwt" },
    );
    expect(result).toMatchObject({ ok: false, status: 400, body: { error: "invalid_guest_token" } });
  });

  it("rejects a guest token minted for another project", async () => {
    const db = createDb();
    const tokens = { "other.jwt": { userId: "u_guest", projectId: "p2", roles: ["guest"] } };
    const result = await linkGuestToAccount(
      createEnv(db),
      { verifyJwtAndGetContext: createVerify(tokens) },
      { projectId: "p1", targetUserId: "u_target", targetRoles: ["member"], guestToken: "other.jwt" },
    );
    expect(result).toMatchObject({ ok: false, status: 400, body: { error: "invalid_guest_token" } });
  });

  it("rejects a second claim of the same guest", async () => {
    const db = createDb({
      links: [{ project_id: "p1", guest_user_id: "u_guest", target_user_id: "u_first" }],
    });
    const result = await linkGuestToAccount(
      createEnv(db),
      { verifyJwtAndGetContext: createVerify(GUEST_TOKENS) },
      { projectId: "p1", targetUserId: "u_target", targetRoles: ["member"], guestToken: GUEST_TOKEN },
    );
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      body: { error: "guest_already_linked", targetUserId: "u_first" },
    });
    expect(db.state.batchCalls).toBe(0);
  });

  it("rejects linking a guest to itself and to another guest", async () => {
    const db = createDb();
    const deps = { verifyJwtAndGetContext: createVerify(GUEST_TOKENS) };

    const same = await linkGuestToAccount(createEnv(db), deps, {
      projectId: "p1",
      targetUserId: "u_guest",
      targetRoles: ["member"],
      guestToken: GUEST_TOKEN,
    });
    expect(same).toMatchObject({ ok: false, status: 400, body: { error: "same_user" } });

    const guestTarget = await linkGuestToAccount(createEnv(db), deps, {
      projectId: "p1",
      targetUserId: "u_target",
      targetRoles: ["guest"],
      guestToken: GUEST_TOKEN,
    });
    expect(guestTarget).toMatchObject({ ok: false, status: 400, body: { error: "target_is_guest" } });
  });

  it("reports the winner when a concurrent claim loses the race", async () => {
    const db = createDb({
      onBatch: (state) => {
        state.links.push({ project_id: "p1", guest_user_id: "u_guest", target_user_id: "u_rival" });
        throw new Error("UNIQUE constraint failed: guest_links.project_id, guest_links.guest_user_id");
      },
    });
    const result = await linkGuestToAccount(
      createEnv(db),
      { verifyJwtAndGetContext: createVerify(GUEST_TOKENS) },
      { projectId: "p1", targetUserId: "u_target", targetRoles: ["member"], guestToken: GUEST_TOKEN },
    );
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      body: { error: "guest_already_linked", targetUserId: "u_rival" },
    });
  });
});
