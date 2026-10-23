import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FluxyChatClient } from "./index";

describe("FluxyChatClient Wave E (chat core)", () => {
  const baseUrl = "http://127.0.0.1:8787";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function client() {
    return new FluxyChatClient({ baseUrl, userId: "alice", token: "jwt_abc" });
  }

  function respond(body: unknown, status = 200) {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
    return fetchMock;
  }

  function lastCall(fetchMock: ReturnType<typeof vi.mocked<typeof fetch>>) {
    return fetchMock.mock.calls[fetchMock.mock.calls.length - 1]!;
  }

  it("save/unsave hit the message save route", async () => {
    const c = client();
    const fetchMock = respond({ ok: true, saved: true });
    expect(await c.saveMessageRest(7)).toEqual({ ok: true, saved: true });
    let [url, init] = lastCall(fetchMock);
    expect(String(url)).toBe(`${baseUrl}/messages/7/save`);
    expect(init?.method).toBe("POST");

    fetchMock.mockClear();
    respond({ ok: true, saved: false });
    await c.unsaveMessageRest(7);
    [url, init] = lastCall(fetchMock);
    expect(String(url)).toBe(`${baseUrl}/messages/7/save`);
    expect(init?.method).toBe("DELETE");
  });

  it("listSavedMessagesRest sends the limit and parses items", async () => {
    const fetchMock = respond({
      items: [
        {
          messageId: 7,
          roomId: "r1",
          roomName: "general",
          authorId: "bob",
          preview: "hi",
          createdAt: "t0",
          savedAt: "t1",
        },
      ],
    });
    const items = await client().listSavedMessagesRest(10);
    expect(items).toHaveLength(1);
    expect(String(lastCall(fetchMock)[0])).toBe(`${baseUrl}/saved-messages?limit=10`);
  });

  it("forwardMessageRest posts the target room and throws on denial", async () => {
    const fetchMock = respond({ message: { id: 99, roomId: "room-2" } });
    const message = await client().forwardMessageRest(7, "room-2");
    expect(message).toEqual({ id: 99, roomId: "room-2" });
    const [, init] = lastCall(fetchMock);
    expect(JSON.parse(String(init?.body))).toEqual({ targetRoomId: "room-2" });

    respond({ error: "forbidden_target_room" }, 403);
    await expect(client().forwardMessageRest(7, "room-9")).rejects.toThrow(
      /forbidden_target_room/,
    );
  });

  it("user group methods hit the right urls", async () => {
    const fetchMock = respond({ groups: [{ id: "g1", name: "design", memberIds: [] }] });
    expect(await client().listUserGroupsRest()).toHaveLength(1);

    respond({ group: { id: "g1", name: "design", memberIds: ["u1"] } });
    const created = await client().createUserGroupRest("design", ["u1"]);
    expect(created?.name).toBe("design");
    expect(JSON.parse(String(lastCall(fetchMock)[1]?.body))).toEqual({
      name: "design",
      memberIds: ["u1"],
    });

    respond({ ok: true });
    await client().deleteUserGroupRest("g 1");
    expect(String(lastCall(fetchMock)[0])).toBe(`${baseUrl}/user-groups/g%201`);

    respond({ ok: true });
    await client().addUserGroupMembersRest("g1", ["u2"]);
    expect(String(lastCall(fetchMock)[0])).toBe(`${baseUrl}/user-groups/g1/members`);

    respond({ ok: true });
    await client().removeUserGroupMemberRest("g1", "u2");
    expect(String(lastCall(fetchMock)[0])).toBe(`${baseUrl}/user-groups/g1/members/u2`);
  });

  it("room folder methods cover list/create/rename/delete and room membership", async () => {
    const fetchMock = respond({
      folders: [{ id: "f1", name: "Work", position: 0, roomIds: ["r1"] }],
    });
    expect(await client().listRoomFoldersRest()).toHaveLength(1);

    respond({ folder: { id: "f1", name: "Work", position: 0, roomIds: [] } });
    expect((await client().createRoomFolderRest("Work"))?.name).toBe("Work");

    respond({ ok: true, folder: { id: "f1", name: "Renamed" } });
    await client().renameRoomFolderRest("f1", "Renamed");
    expect(lastCall(fetchMock)[1]?.method).toBe("PATCH");

    respond({ ok: true });
    await client().deleteRoomFolderRest("f1");
    expect(lastCall(fetchMock)[1]?.method).toBe("DELETE");

    respond({ ok: true });
    await client().setRoomFolderItemRest("f1", "r1");
    expect(String(lastCall(fetchMock)[0])).toBe(`${baseUrl}/room-folders/f1/rooms`);

    respond({ ok: true });
    await client().removeRoomFolderItemRest("f1", "r1");
    expect(String(lastCall(fetchMock)[0])).toBe(`${baseUrl}/room-folders/f1/rooms/r1`);
  });

  it("notification keyword methods list/add/remove (percent-encoded)", async () => {
    const fetchMock = respond({ keywords: [{ word: "deploy", createdAt: "t0" }] });
    expect(await client().listNotificationKeywordsRest()).toHaveLength(1);

    respond({ ok: true, keyword: "deploy now" });
    await client().addNotificationKeywordRest("deploy now");
    expect(JSON.parse(String(lastCall(fetchMock)[1]?.body))).toEqual({ word: "deploy now" });

    respond({ ok: true, keyword: "deploy now" });
    await client().removeNotificationKeywordRest("deploy now");
    expect(String(lastCall(fetchMock)[0])).toBe(`${baseUrl}/notification-keywords/deploy%20now`);
  });

  it("custom emoji methods list/create/delete", async () => {
    const fetchMock = respond({ emojis: [{ id: "e1", name: "parrot", imageUrl: "https://x/p.png" }] });
    expect(await client().listCustomEmojisRest()).toHaveLength(1);

    respond({ emoji: { id: "e1", name: "parrot", imageUrl: "https://x/p.png" } });
    expect((await client().createCustomEmojiRest("parrot", "https://x/p.png"))?.id).toBe("e1");

    respond({ ok: true });
    await client().deleteCustomEmojiRest("e1");
    expect(String(lastCall(fetchMock)[0])).toBe(`${baseUrl}/custom-emojis/e1`);
  });

  it("room bookmark methods list/create/delete", async () => {
    const fetchMock = respond({ bookmarks: [{ id: "b1", label: "Docs", url: "https://d", position: 0 }] });
    expect(await client().listRoomBookmarksRest("room 1")).toHaveLength(1);
    expect(String(lastCall(fetchMock)[0])).toBe(`${baseUrl}/rooms/room%201/bookmarks`);

    respond({ bookmark: { id: "b1", label: "Docs", url: "https://d", position: 0 } });
    expect((await client().createRoomBookmarkRest("r1", "Docs", "https://d"))?.id).toBe("b1");

    respond({ ok: true });
    await client().deleteRoomBookmarkRest("r1", "b1");
    expect(String(lastCall(fetchMock)[0])).toBe(`${baseUrl}/rooms/r1/bookmarks/b1`);
  });
});
