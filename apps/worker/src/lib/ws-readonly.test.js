import { describe, expect, it } from "vitest";
import {
  isReadonlyAllowedClientType,
  isReadonlyWsConnect,
  parseReadonlyConnectParam,
  readonlyConnectionError,
} from "./ws-readonly.js";

describe("ws-readonly", () => {
  it("parses query flags", () => {
    expect(parseReadonlyConnectParam("1")).toBe(true);
    expect(parseReadonlyConnectParam("readonly")).toBe(true);
    expect(parseReadonlyConnectParam("0")).toBe(false);
  });

  it("treats spectator roles and publish:false as readonly", () => {
    expect(isReadonlyWsConnect({ roles: ["spectator"] })).toBe(true);
    expect(isReadonlyWsConnect({ roles: ["member"] })).toBe(false);
    expect(isReadonlyWsConnect({ capabilities: { publish: false } })).toBe(true);
    expect(isReadonlyWsConnect({ queryMode: "spectator" })).toBe(true);
  });

  it("allows only ping and resume", () => {
    expect(isReadonlyAllowedClientType("ping")).toBe(true);
    expect(isReadonlyAllowedClientType("resume")).toBe(true);
    expect(isReadonlyAllowedClientType("message")).toBe(false);
    expect(isReadonlyAllowedClientType("typing")).toBe(false);
    expect(readonlyConnectionError().message).toBe("readonly_connection");
  });
});
