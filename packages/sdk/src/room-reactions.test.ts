import { describe, expect, it } from "vitest";
import { bindRoomReactions } from "./room-reactions";
import type { FluxyChatRoomConnection } from "./room-connection";

describe("bindRoomReactions", () => {
  it("FX-RREAC-1 send trims name and subscribe forwards inbound", () => {
    const sent: string[] = [];
    let handler: ((event: { type: "room_reaction"; userId: string; name: string }) => void) | null =
      null;
    const connection = {
      sendRoomReaction(name: string, extras?: { metadata?: Record<string, unknown>; headers?: Record<string, string> }) {
        sent.push(extras ? `${name}:${JSON.stringify(extras)}` : name);
      },
      onRoomReaction(cb: typeof handler) {
        handler = cb;
        return () => {
          handler = null;
        };
      },
    } as unknown as FluxyChatRoomConnection;

    const reactions = bindRoomReactions(connection);
    reactions.send("👏");
    reactions.send({ name: "🔥", metadata: { burst: true }, headers: { source: "ui" } });
    expect(sent).toEqual([
      "👏",
      '🔥:{"metadata":{"burst":true},"headers":{"source":"ui"}}',
    ]);
    const names: string[] = [];
    const sub = reactions.subscribe((event) => names.push(event.reaction.name));
    handler?.({ type: "room_reaction", userId: "ada", name: "🔥" });
    expect(names).toEqual(["🔥"]);
    expect(typeof sub.unsubscribe).toBe("function");
  });
});
