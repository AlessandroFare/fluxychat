import { describe, expect, it } from "vitest";
import { restoreScrollAfterPrepend } from "./preserve-scroll-top";

describe("restoreScrollAfterPrepend", () => {
  it("shifts scrollTop by the height delta", () => {
    const el = { scrollHeight: 800, scrollTop: 40 } as HTMLElement;
    restoreScrollAfterPrepend(el, { height: 500, top: 40 });
    expect(el.scrollTop).toBe(340);
  });
});
