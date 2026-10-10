import { describe, expect, it } from "vitest";
import {
  formatRoomEventLine,
  fluxyRoomVersion,
  parseFluxyRoomArgs,
  runExists,
  runHistory,
  runOccupancy,
  runPresence,
  runUpdate,
  runDelete,
  runGet,
  runReact,
  runUnreact,
  runReactionSummary,
  runVersions,
} from "./fluxy-room-cli";
import { FLUXY_SDK_VERSION } from "./version";

describe("fluxy-room cli", () => {
  it("parses health send and tail", () => {
    expect(parseFluxyRoomArgs(["help"]).kind).toBe("help");
    expect(
      parseFluxyRoomArgs(["health", "--worker", "https://w.example"]),
    ).toEqual({
      kind: "health",
      worker: "https://w.example",
      token: "",
    });
    expect(
      parseFluxyRoomArgs([
        "send",
        "--worker",
        "https://w.example",
        "--token",
        "jwt",
        "--room",
        "lobby",
        "--text",
        "hi",
        "--user",
        "ops",
        "--metadata",
        '{"ticket":true}',
        "--headers",
        '{"source":"cli"}',
      ]),
    ).toMatchObject({
      kind: "send",
      room: "lobby",
      text: "hi",
      userId: "ops",
      metadata: { ticket: true },
      headers: { source: "cli" },
    });
    expect(
      parseFluxyRoomArgs([
        "send",
        "--worker",
        "https://w.example",
        "--token",
        "jwt",
        "--room",
        "lobby",
        "--text",
        "hi",
        "--metadata",
        "nope",
      ]).kind,
    ).toBe("error");
    expect(parseFluxyRoomArgs(["tail", "--worker", "https://w.example"]).kind).toBe("error");
    expect(
      parseFluxyRoomArgs([
        "occupancy",
        "--worker",
        "https://w.example",
        "--token",
        "jwt",
        "--room",
        "lobby",
      ]),
    ).toEqual({
      kind: "occupancy",
      worker: "https://w.example",
      token: "jwt",
      room: "lobby",
    });
    expect(
      parseFluxyRoomArgs([
        "exists",
        "--worker",
        "https://w.example",
        "--token",
        "jwt",
        "--room",
        "lobby",
      ]).kind,
    ).toBe("exists");
    expect(
      parseFluxyRoomArgs([
        "history",
        "--worker",
        "https://w.example",
        "--token",
        "jwt",
        "--room",
        "lobby",
        "--limit",
        "20",
        "--before",
        "2026-01-01T00:00:00.000Z",
      ]),
    ).toEqual({
      kind: "history",
      worker: "https://w.example",
      token: "jwt",
      room: "lobby",
      limit: 20,
      before: "2026-01-01T00:00:00.000Z",
    });
    expect(
      parseFluxyRoomArgs([
        "presence",
        "--worker",
        "https://w.example",
        "--token",
        "jwt",
        "--room",
        "lobby",
      ]),
    ).toMatchObject({ kind: "presence", room: "lobby" });
    expect(
      parseFluxyRoomArgs([
        "send",
        "--worker",
        "https://w.example",
        "--token",
        "jwt",
        "--room",
        "lobby",
        "--text",
        "reply",
        "--reply-to",
        "9",
      ]),
    ).toMatchObject({ kind: "send", replyTo: 9 });
    expect(
      parseFluxyRoomArgs([
        "update",
        "--worker",
        "https://w.example",
        "--token",
        "jwt",
        "--room",
        "lobby",
        "--id",
        "9",
        "--text",
        "edited",
        "--description",
        "typo",
      ]),
    ).toMatchObject({ kind: "update", messageId: 9, text: "edited", description: "typo" });
    expect(
      parseFluxyRoomArgs([
        "delete",
        "--worker",
        "https://w.example",
        "--token",
        "jwt",
        "--room",
        "lobby",
        "--id",
        "9",
      ]),
    ).toMatchObject({ kind: "delete", messageId: 9 });
    expect(
      parseFluxyRoomArgs([
        "get",
        "--worker",
        "https://w.example",
        "--token",
        "jwt",
        "--room",
        "lobby",
        "--id",
        "9",
      ]),
    ).toMatchObject({ kind: "get", messageId: 9 });
    expect(
      parseFluxyRoomArgs([
        "react",
        "--worker",
        "https://w.example",
        "--token",
        "jwt",
        "--room",
        "lobby",
        "--id",
        "9",
        "--emoji",
        "👍",
      ]),
    ).toMatchObject({ kind: "react", messageId: 9, emoji: "👍" });
    expect(
      parseFluxyRoomArgs([
        "unreact",
        "--worker",
        "https://w.example",
        "--token",
        "jwt",
        "--room",
        "lobby",
        "--serial",
        "9",
        "--name",
        "👍",
      ]),
    ).toMatchObject({ kind: "unreact", messageId: 9, emoji: "👍" });
    expect(
      parseFluxyRoomArgs([
        "reactions",
        "--worker",
        "https://w.example",
        "--token",
        "jwt",
        "--room",
        "lobby",
        "--id",
        "9",
      ]),
    ).toMatchObject({ kind: "reactions", messageId: 9 });
    expect(
      parseFluxyRoomArgs([
        "versions",
        "--worker",
        "https://w.example",
        "--token",
        "jwt",
        "--room",
        "lobby",
        "--id",
        "9",
      ]),
    ).toMatchObject({ kind: "versions", messageId: 9 });
    expect(parseFluxyRoomArgs(["version"])).toEqual({ kind: "version" });
    expect(fluxyRoomVersion()).toBe(FLUXY_SDK_VERSION);
  });

  it("FX-CLI-1 formats occupancy.updated and occupancy lines", () => {
    expect(
      formatRoomEventLine({ type: "message", userId: "ada", content: "hello" }),
    ).toBe("[message] ada: hello");
    expect(
      formatRoomEventLine({ type: "occupancy", connections: 2, presenceMembers: 1 }),
    ).toBe("[occupancy] connections=2 members=1 watching=1");
    expect(
      formatRoomEventLine({
        type: "occupancy.updated",
        occupancy: { connections: 4, presenceMembers: 3 },
      }),
    ).toBe("[occupancy] connections=4 members=3 watching=1");
    expect(
      formatRoomEventLine({ type: "typing.set.changed", currentlyTyping: ["ada", "bob"] }),
    ).toBe("[typing] ada,bob");
    expect(formatRoomEventLine({ type: "reaction", userId: "ada", emoji: "👍", op: "add" })).toBe(
      "[reaction] ada add 👍",
    );
  });

  it("FX-CLI-1 occupancy and exists hit /live", async () => {
    const occupancyFetch = (async () =>
      new Response(JSON.stringify({ subscriptionCount: 5, userCount: 2, members: [] }), {
        status: 200,
      })) as typeof fetch;
    expect(await runOccupancy("https://w.example", "jwt", "lobby", occupancyFetch)).toBe(
      JSON.stringify({ connections: 5, presenceMembers: 2, watching: 3 }),
    );
    const missingFetch = (async () => new Response("gone", { status: 404 })) as typeof fetch;
    expect(await runExists("https://w.example", "jwt", "missing", missingFetch)).toBe("false");
  });

  it("history and presence hit REST like ably-cli rooms:messages:history / presence:get", async () => {
    const historyFetch = (async (url: string | URL) => {
      expect(String(url)).toContain("/api/messages");
      expect(String(url)).toContain("roomId=lobby");
      return new Response(JSON.stringify({ messages: [{ id: 1, content: "hi" }] }), { status: 200 });
    }) as typeof fetch;
    expect(await runHistory("https://w.example", "jwt", "lobby", { limit: 20 }, historyFetch)).toBe(
      JSON.stringify([{ id: 1, content: "hi" }]),
    );
    const presenceFetch = (async () =>
      new Response(JSON.stringify({ members: [{ userId: "ada" }, { userId: "bob" }] }), {
        status: 200,
      })) as typeof fetch;
    expect(await runPresence("https://w.example", "jwt", "lobby", presenceFetch)).toBe(
      JSON.stringify({ members: ["ada", "bob"] }),
    );
  });

  it("update and delete hit PATCH/DELETE /messages/:id like ably-cli rooms:messages", async () => {
    const updateFetch = (async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toContain("/messages/9");
      expect(init?.method).toBe("PATCH");
      return new Response(JSON.stringify({ message: { id: 9, content: "edited" } }), { status: 200 });
    }) as typeof fetch;
    expect(JSON.parse(await runUpdate("https://w.example", "jwt", 9, "edited", {}, updateFetch))).toEqual({
      message: { id: 9, content: "edited" },
    });
    const deleteFetch = (async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toContain("/messages/9");
      expect(init?.method).toBe("DELETE");
      return new Response(JSON.stringify({ message: { id: 9 } }), { status: 200 });
    }) as typeof fetch;
    expect(JSON.parse(await runDelete("https://w.example", "jwt", 9, {}, deleteFetch))).toEqual({
      message: { id: 9 },
    });
  });

  it("get/react/unreact/reactions hit /messages/:id like ably-cli rooms:messages:get and reactions", async () => {
    const getFetch = (async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toContain("/messages/9");
      expect(init?.method ?? "GET").toBe("GET");
      return new Response(JSON.stringify({ message: { id: 9, content: "hi" } }), { status: 200 });
    }) as typeof fetch;
    expect(JSON.parse(await runGet("https://w.example", "jwt", 9, getFetch))).toEqual({
      message: { id: 9, content: "hi" },
    });
    const reactFetch = (async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toContain("/messages/9/reactions");
      expect(init?.method).toBe("POST");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;
    expect(JSON.parse(await runReact("https://w.example", "jwt", 9, "👍", reactFetch))).toEqual({
      ok: true,
    });
    const unreactFetch = (async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toContain("/messages/9/reactions");
      expect(init?.method).toBe("DELETE");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;
    expect(JSON.parse(await runUnreact("https://w.example", "jwt", 9, "👍", unreactFetch))).toEqual({
      ok: true,
    });
    const summaryFetch = (async (url: string | URL) => {
      expect(String(url)).toContain("/messages/9/reactions/summary");
      return new Response(JSON.stringify({ unique: { "👍": { total: 1 } } }), { status: 200 });
    }) as typeof fetch;
    expect(JSON.parse(await runReactionSummary("https://w.example", "jwt", 9, summaryFetch))).toEqual({
      unique: { "👍": { total: 1 } },
    });
    const versionsFetch = (async (url: string | URL) => {
      expect(String(url)).toContain("/messages/9/versions");
      return new Response(JSON.stringify({ items: [{ id: 9, content: "v1" }] }), { status: 200 });
    }) as typeof fetch;
    expect(JSON.parse(await runVersions("https://w.example", "jwt", 9, versionsFetch))).toEqual([
      { id: 9, content: "v1" },
    ]);
  });
});
