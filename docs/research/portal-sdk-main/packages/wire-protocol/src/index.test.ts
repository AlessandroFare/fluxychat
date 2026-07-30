import { describe, expect, it } from "vitest";

import {
  PORTAL_ERROR_HEADER,
  PROTOCOL_VERSION,
  REFUSAL_STATUS,
  UPGRADE_PARAMS,
  type RefusalCode,
} from "./index.js";

describe("constants", () => {
  it("pins the protocol version carried by every upgrade (§1.1)", () => {
    expect(PROTOCOL_VERSION).toBe(1);
  });

  it("names every upgrade query param (§1.1)", () => {
    expect(UPGRADE_PARAMS).toStrictEqual({
      version: "v",
      token: "token",
      key: "key",
      leaf: "leaf",
      meta: "meta",
      last: "last",
    });
  });

  it("pins the refusal header (§1.1)", () => {
    expect(PORTAL_ERROR_HEADER).toBe("x-portal-error");
  });
});

describe("refusal table (§1.1)", () => {
  // The table is the contract: every documented code maps to the documented status.
  const expected: Record<RefusalCode, number> = {
    invalid_token: 401,
    token_expired: 401,
    invalid_api_key: 403,
    not_member: 403,
    banned: 403,
    anonymous_not_allowed: 403,
    unknown_channel: 404,
    unsupported_version: 426,
    channel_at_capacity: 429,
  };

  it("maps every code to its documented status, and nothing extra", () => {
    expect(REFUSAL_STATUS).toStrictEqual(expected);
  });
});
