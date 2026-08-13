import { describe, it, expect, vi } from "vitest";
import {
  buildDecisionRoomPackPreview,
  provisionDecisionRoomPack,
  DECISION_ROOM_PACK_ID,
} from "./decision-rooms-pack.js";

describe("NW-201 decision-rooms-pack", () => {
  it("builds pack preview with four features", () => {
    const preview = buildDecisionRoomPackPreview({ name: "Q3 Planning" });
    expect(preview.packId).toBe(DECISION_ROOM_PACK_ID);
    expect(preview.name).toBe("Q3 Planning");
    expect(preview.features).toHaveLength(4);
    expect(preview.templates.length).toBeGreaterThanOrEqual(3);
    expect(preview.welcomeMessage).toContain("Decision Rooms");
  });

  it("provisions room and templates", async () => {
    const createTemplate = vi.fn(async (t) => ({ id: `tpl_${t.name}`, ...t }));
    const postWelcome = vi.fn(async () => ({}));
    const result = await provisionDecisionRoomPack({}, {
      projectId: "p1",
      userId: "u1",
      name: "Board Decision",
      createRoom: async ({ name, type }) => ({ id: "room_dec_1", name, type }),
      createTemplate,
      postWelcome,
    });
    expect(result.ok).toBe(true);
    expect(result.room.id).toBe("room_dec_1");
    expect(result.templatesCreated).toBe(3);
    expect(createTemplate).toHaveBeenCalledTimes(3);
    expect(postWelcome).toHaveBeenCalledOnce();
  });
});
