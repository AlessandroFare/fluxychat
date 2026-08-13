import { describe, it, expect, vi } from "vitest";
import {
  buildEnterpriseAgentRoomPreview,
  provisionEnterpriseAgentRoom,
  ENTERPRISE_AGENT_ROOM_PACK_ID,
} from "./enterprise-agent-room-pack.js";

describe("NW-202 enterprise-agent-room-pack", () => {
  it("builds preview with audit + cross-org links", () => {
    const preview = buildEnterpriseAgentRoomPreview({ name: "ACME Agents" });
    expect(preview.packId).toBe(ENTERPRISE_AGENT_ROOM_PACK_ID);
    expect(preview.features.length).toBeGreaterThanOrEqual(4);
    expect(preview.welcomeMessage).toContain("Enterprise Agent Room");
  });

  it("provisions room", async () => {
    const postWelcome = vi.fn(async () => ({}));
    const result = await provisionEnterpriseAgentRoom({}, {
      projectId: "p1",
      userId: "u1",
      name: "B2B Room",
      createRoom: async ({ name, type }) => ({ id: "room_ent_1", name, type }),
      postWelcome,
    });
    expect(result.ok).toBe(true);
    expect(result.room.id).toBe("room_ent_1");
    expect(postWelcome).toHaveBeenCalledOnce();
  });
});
