import { describe, expect, it } from "vitest";
import {
  addUserGroupMembers,
  createUserGroup,
  deleteUserGroup,
  getUserGroupMemberIds,
  listUserGroupNames,
  listUserGroups,
  removeUserGroupMember,
} from "./user-groups.js";

function createEnv() {
  const groups = [];
  const members = [];

  const run = (sql, args) => {
    if (sql.includes("INSERT INTO user_groups")) {
      groups.push({
        id: args[0],
        project_id: args[1],
        name: args[2],
        created_at: args[3],
      });
    } else if (sql.includes("INSERT OR IGNORE INTO user_group_members")) {
      if (!members.some((m) => m.group_id === args[0] && m.user_id === args[2])) {
        members.push({
          group_id: args[0],
          project_id: args[1],
          user_id: args[2],
          created_at: args[3],
        });
      }
    } else if (sql.includes("DELETE FROM user_group_members") && sql.includes("user_id = ?")) {
      const [groupId, projectId, userId] = args;
      for (let i = members.length - 1; i >= 0; i -= 1) {
        const m = members[i];
        if (m.group_id === groupId && m.project_id === projectId && m.user_id === userId) {
          members.splice(i, 1);
        }
      }
    } else if (sql.includes("DELETE FROM user_group_members")) {
      const [groupId, projectId] = args;
      for (let i = members.length - 1; i >= 0; i -= 1) {
        const m = members[i];
        if (m.group_id === groupId && m.project_id === projectId) members.splice(i, 1);
      }
    } else if (sql.includes("DELETE FROM user_groups")) {
      const [groupId, projectId] = args;
      for (let i = groups.length - 1; i >= 0; i -= 1) {
        const g = groups[i];
        if (g.id === groupId && g.project_id === projectId) groups.splice(i, 1);
      }
    }
  };

  const one = (sql, args) => {
    if (sql.includes("COUNT(*)") && sql.includes("FROM user_groups")) {
      return { c: groups.filter((g) => g.project_id === args[0]).length };
    }
    if (sql.includes("FROM user_groups") && sql.includes("name = ?")) {
      return groups.find((g) => g.project_id === args[0] && g.name === args[1]) || null;
    }
    if (sql.includes("FROM user_groups") && sql.includes("id = ?")) {
      return groups.find((g) => g.id === args[0] && g.project_id === args[1]) || null;
    }
    return null;
  };

  const many = (sql, args) => {
    if (sql.includes("SELECT group_id, user_id FROM user_group_members")) {
      return members.map(({ group_id, user_id }) => ({ group_id, user_id }));
    }
    if (sql.includes("SELECT user_id FROM user_group_members")) {
      return members
        .filter((m) => m.group_id === args[0] && m.project_id === args[1])
        .map((m) => ({ user_id: m.user_id }));
    }
    if (sql.includes("SELECT id, name, created_at FROM user_groups")) {
      return groups
        .filter((g) => g.project_id === args[0])
        .map((g) => ({ id: g.id, name: g.name, created_at: g.created_at }));
    }
    if (sql.includes("SELECT name FROM user_groups")) {
      return groups.filter((g) => g.project_id === args[0]).map((g) => ({ name: g.name }));
    }
    return [];
  };

  return {
    groups,
    members,
    env: {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                sql,
                args,
                async run() {
                  run(sql, args);
                  return { meta: {} };
                },
                async first() {
                  return one(sql, args);
                },
                async all() {
                  return { results: many(sql, args) };
                },
              };
            },
          };
        },
        async batch(stmts) {
          for (const stmt of stmts) run(stmt.sql, stmt.args);
        },
      },
    },
  };
}

describe("user-groups", () => {
  it("validates the group name", async () => {
    const { env } = createEnv();
    expect((await createUserGroup(env, { projectId: "p1", name: "a" })).error).toBe(
      "invalid_group_name",
    );
    expect(
      (await createUserGroup(env, { projectId: "p1", name: "Bad Name!" })).error,
    ).toBe("invalid_group_name");
  });

  it("creates, lists with members, and rejects duplicates", async () => {
    const { env } = createEnv();
    const created = await createUserGroup(env, {
      projectId: "p1",
      name: "Design",
      memberIds: ["u1", "u1", "u2", ""],
    });
    expect(created.ok).toBe(true);
    expect(created.group.name).toBe("design");
    expect(created.group.memberIds).toEqual(["u1", "u2"]);

    const dup = await createUserGroup(env, { projectId: "p1", name: "design" });
    expect(dup.error).toBe("group_exists");
    expect(dup.status).toBe(409);

    const list = await listUserGroups(env, { projectId: "p1" });
    expect(list.groups).toEqual([
      expect.objectContaining({ name: "design", memberIds: ["u1", "u2"] }),
    ]);
    expect(await listUserGroupNames(env, { projectId: "p1" })).toEqual(["design"]);
    expect(await getUserGroupMemberIds(env, { projectId: "p1", name: "DESIGN" })).toEqual([
      "u1",
      "u2",
    ]);
    expect(await getUserGroupMemberIds(env, { projectId: "p1", name: "missing" })).toEqual([]);
  });

  it("adds and removes members, then deletes the group", async () => {
    const { env, groups, members } = createEnv();
    const { group } = await createUserGroup(env, { projectId: "p1", name: "ops" });

    expect(
      (await addUserGroupMembers(env, { projectId: "p1", groupId: "missing", userIds: ["u9"] }))
        .status,
    ).toBe(404);
    const added = await addUserGroupMembers(env, {
      projectId: "p1",
      groupId: group.id,
      userIds: ["u3", "u3"],
    });
    expect(added).toEqual({ ok: true, added: 1 });

    await removeUserGroupMember(env, { projectId: "p1", groupId: group.id, userId: "u3" });
    expect(members).toHaveLength(0);

    await deleteUserGroup(env, { projectId: "p1", groupId: group.id });
    expect(groups).toHaveLength(0);
    expect(members).toHaveLength(0);
  });
});
