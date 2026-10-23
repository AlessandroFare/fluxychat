import { describe, expect, it } from "vitest";
import {
  createCustomEmoji,
  customEmojiToken,
  deleteCustomEmoji,
  isValidCustomEmojiUrl,
  listCustomEmojis,
  normalizeCustomEmojiName,
} from "./custom-emoji.js";

function createEnv(seed = []) {
  const rows = seed.map((row) => ({ ...row }));
  return {
    rows,
    env: {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async run() {
                  if (sql.includes("INSERT INTO custom_emojis")) {
                    rows.push({
                      id: args[0],
                      project_id: args[1],
                      name: args[2],
                      image_url: args[3],
                      created_by: args[4],
                      created_at: args[5],
                    });
                  } else if (sql.includes("DELETE FROM custom_emojis")) {
                    const [id, projectId] = args;
                    for (let i = rows.length - 1; i >= 0; i -= 1) {
                      if (rows[i].id === id && rows[i].project_id === projectId) rows.splice(i, 1);
                    }
                  }
                  return { meta: {} };
                },
                async first() {
                  if (sql.includes("COUNT(*)")) {
                    return { c: rows.filter((row) => row.project_id === args[0]).length };
                  }
                  if (sql.includes("WHERE project_id = ? AND name = ?")) {
                    return rows.find((row) => row.project_id === args[0] && row.name === args[1]) || null;
                  }
                  if (sql.includes("WHERE id = ? AND project_id = ?")) {
                    return rows.find((row) => row.id === args[0] && row.project_id === args[1]) || null;
                  }
                  return null;
                },
                async all() {
                  if (sql.includes("FROM custom_emojis")) {
                    return {
                      results: rows
                        .filter((row) => row.project_id === args[0])
                        .map((row) => ({
                          id: row.id,
                          name: row.name,
                          image_url: row.image_url,
                          created_by: row.created_by,
                          created_at: row.created_at,
                        })),
                    };
                  }
                  return { results: [] };
                },
              };
            },
          };
        },
      },
    },
  };
}

describe("custom-emoji", () => {
  it("normalizes names and validates urls", () => {
    expect(normalizeCustomEmojiName(":Party_Parrot:")).toBe("party_parrot");
    expect(customEmojiToken("Party_Parrot")).toBe(":party_parrot:");
    expect(isValidCustomEmojiUrl("https://cdn.example.com/parrot.png")).toBe(true);
    expect(isValidCustomEmojiUrl("http://cdn.example.com/parrot.png")).toBe(false);
    expect(isValidCustomEmojiUrl("javascript:alert(1)")).toBe(false);
  });

  it("creates, lists and rejects duplicates/invalid input", async () => {
    const { env } = createEnv();
    expect(
      (await createCustomEmoji(env, { projectId: "p1", name: "x", imageUrl: "https://a/b.png" })).error,
    ).toBe("invalid_emoji_name");
    expect(
      (await createCustomEmoji(env, { projectId: "p1", name: "parrot", imageUrl: "ftp://a" })).error,
    ).toBe("invalid_emoji_url");

    const created = await createCustomEmoji(env, {
      projectId: "p1",
      name: "Party_Parrot",
      imageUrl: "https://cdn.example.com/parrot.png",
      createdBy: "u1",
    });
    expect(created.ok).toBe(true);
    expect(created.emoji.name).toBe("party_parrot");

    const dup = await createCustomEmoji(env, {
      projectId: "p1",
      name: "party_parrot",
      imageUrl: "https://cdn.example.com/parrot2.png",
    });
    expect(dup.error).toBe("emoji_exists");
    expect(dup.status).toBe(409);

    const list = await listCustomEmojis(env, { projectId: "p1" });
    expect(list.emojis).toEqual([
      expect.objectContaining({ name: "party_parrot", imageUrl: "https://cdn.example.com/parrot.png" }),
    ]);

    expect((await deleteCustomEmoji(env, { projectId: "p1", id: "missing" })).status).toBe(404);
    expect((await deleteCustomEmoji(env, { projectId: "p1", id: created.emoji.id })).ok).toBe(true);
    expect((await listCustomEmojis(env, { projectId: "p1" })).emojis).toEqual([]);
  });
});
