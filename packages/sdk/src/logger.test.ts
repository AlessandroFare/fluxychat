import { describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger";

describe("createLogger", () => {
  it("FX-LOG-1 withContext aliases child and logLevel drops trace", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const logger = createLogger({ prefix: "fluxy", logLevel: "error" });
    expect(logger.logLevel).toBe("error");
    logger.trace("nope");
    expect(spy).not.toHaveBeenCalled();
    const child = logger.withContext({ room: "lobby" });
    child.error("boom");
    spy.mockRestore();
    expect(typeof child.debug).toBe("function");
  });
});
