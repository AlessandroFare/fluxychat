import { describe, it, expect, vi } from "vitest";
import {
  requestContact,
  acceptContactRequest,
  declineContactRequest,
  transferGroupOwnership,
  listIncomingContactRequests,
} from "./user-contacts.js";

function makeDb({ contacts = [], members = [], rooms = [] } = {}) {
  const state = { contacts: [...contacts], members: [...members], rooms: [...rooms] };
  return {
    state,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes("FROM user_contacts") && sql.includes("status = 'pending'") && sql.includes("owner_user_id = ?") && sql.includes("contact_user_id = ?")) {
                return state.contacts.find(
                  (c) => c.owner_user_id === args[1] && c.contact_user_id === args[2] && c.status === "pending",
                ) || null;
              }
              if (sql.includes("FROM user_contacts") && sql.includes("LIMIT 1") && !sql.includes("contact_user_id = ? AND status")) {
                return state.contacts.find(
                  (c) => c.owner_user_id === args[1] && c.contact_user_id === args[2],
                ) || null;
              }
              if (sql.includes("FROM rooms")) {
                return state.rooms.find((r) => r.project_id === args[0] && r.id === args[1]) || null;
              }
              if (sql.includes("FROM room_members") && sql.includes("user_id = ?")) {
                return state.members.find((m) => m.room_id === args[0] && m.user_id === args[1]) || null;
              }
              return null;
            },
            async all() {
              if (sql.includes("contact_user_id = ? AND status = 'pending'")) {
                return {
                  results: state.contacts.filter(
                    (c) => c.project_id === args[0] && c.contact_user_id === args[1] && c.status === "pending",
                  ),
                };
              }
              return { results: [] };
            },
            async run() {
              if (sql.includes("INSERT INTO user_contacts") && sql.includes("'pending'")) {
                state.contacts.push({
                  project_id: args[0],
                  owner_user_id: args[1],
                  contact_user_id: args[2],
                  display_name: args[3],
                  status: "pending",
                });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("UPDATE user_contacts SET status = 'accepted'")) {
                const row = state.contacts.find(
                  (c) => c.owner_user_id === args[2] && c.contact_user_id === args[3],
                );
                if (row) row.status = "accepted";
                return { meta: { changes: row ? 1 : 0 } };
              }
              if (sql.includes("INSERT INTO user_contacts") && sql.includes("'accepted'")) {
                state.contacts.push({
                  project_id: args[0],
                  owner_user_id: args[1],
                  contact_user_id: args[2],
                  status: "accepted",
                });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("DELETE FROM user_contacts") && sql.includes("status = 'pending'")) {
                const before = state.contacts.length;
                state.contacts = state.contacts.filter(
                  (c) => !(c.owner_user_id === args[1] && c.contact_user_id === args[2] && c.status === "pending"),
                );
                return { meta: { changes: before - state.contacts.length } };
              }
              if (sql.includes("UPDATE room_members SET role = 'admin'")) {
                const m = state.members.find((row) => row.room_id === args[0] && row.user_id === args[1]);
                if (m) m.role = "admin";
                return { meta: { changes: 1 } };
              }
              if (sql.includes("UPDATE room_members SET role = 'owner'")) {
                const m = state.members.find((row) => row.room_id === args[0] && row.user_id === args[1]);
                if (m) m.role = "owner";
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            },
          };
        },
      };
    },
    async batch(stmts) {
      for (const s of stmts) await s.run();
    },
  };
}

describe("NW-132 user-contacts social graph", () => {
  it("requestContact creates pending request", async () => {
    const db = makeDb();
    const result = await requestContact({ DB: db }, {
      projectId: "p1",
      ownerUserId: "alice",
      contactUserId: "bob",
      displayName: "Bob",
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("pending");
    expect(db.state.contacts[0].status).toBe("pending");
  });

  it("acceptContactRequest mirrors both directions", async () => {
    const db = makeDb({
      contacts: [{
        project_id: "p1",
        owner_user_id: "alice",
        contact_user_id: "bob",
        status: "pending",
      }],
    });
    const result = await acceptContactRequest({ DB: db }, {
      projectId: "p1",
      ownerUserId: "bob",
      fromUserId: "alice",
    });
    expect(result.ok).toBe(true);
    expect(db.state.contacts.some((c) => c.owner_user_id === "alice" && c.status === "accepted")).toBe(true);
    expect(db.state.contacts.some((c) => c.owner_user_id === "bob" && c.contact_user_id === "alice")).toBe(true);
  });

  it("declineContactRequest removes pending", async () => {
    const db = makeDb({
      contacts: [{
        project_id: "p1",
        owner_user_id: "alice",
        contact_user_id: "bob",
        status: "pending",
      }],
    });
    const result = await declineContactRequest({ DB: db }, {
      projectId: "p1",
      ownerUserId: "bob",
      fromUserId: "alice",
    });
    expect(result.ok).toBe(true);
    expect(db.state.contacts).toHaveLength(0);
  });

  it("listIncomingContactRequests returns pending for recipient", async () => {
    const db = makeDb({
      contacts: [{
        project_id: "p1",
        owner_user_id: "alice",
        contact_user_id: "bob",
        display_name: "Alice",
        status: "pending",
        created_at: "t",
        updated_at: "t",
      }],
    });
    const rows = await listIncomingContactRequests({ DB: db }, { projectId: "p1", userId: "bob" });
    expect(rows).toHaveLength(1);
    expect(rows[0].fromUserId).toBe("alice");
  });

  it("transferGroupOwnership demotes previous owner", async () => {
    const db = makeDb({
      rooms: [{ project_id: "p1", id: "r1", type: "group" }],
      members: [
        { room_id: "r1", user_id: "alice", role: "owner" },
        { room_id: "r1", user_id: "bob", role: "member" },
      ],
    });
    // batch helper needs prepare().bind().run() chain - fix mock
    db.prepare = function prepare(sql) {
      const self = this;
      return {
        bind(...args) {
          const stmt = {
            async first() {
              if (sql.includes("FROM rooms")) {
                return self.state.rooms.find((r) => r.project_id === args[0] && r.id === args[1]) || null;
              }
              if (sql.includes("FROM room_members")) {
                return self.state.members.find((m) => m.room_id === args[0] && m.user_id === args[1]) || null;
              }
              return null;
            },
            async run() {
              if (sql.includes("role = 'admin'")) {
                const m = self.state.members.find((row) => row.room_id === args[0] && row.user_id === args[1]);
                if (m) m.role = "admin";
              }
              if (sql.includes("role = 'owner'")) {
                const m = self.state.members.find((row) => row.room_id === args[0] && row.user_id === args[1]);
                if (m) m.role = "owner";
              }
              return { meta: { changes: 1 } };
            },
          };
          return stmt;
        },
      };
    };

    const result = await transferGroupOwnership({ DB: db }, {
      projectId: "p1",
      roomId: "r1",
      fromUserId: "alice",
      toUserId: "bob",
    });
    expect(result.ok).toBe(true);
    expect(db.state.members.find((m) => m.user_id === "alice").role).toBe("admin");
    expect(db.state.members.find((m) => m.user_id === "bob").role).toBe("owner");
  });
});
