import { describe, expect, it } from "vitest";
import {
  AdapterError,
  AdapterNotFoundError,
  AdapterRateLimitError,
  AuthenticationError,
  MessageNotFoundError,
  NetworkError,
  PermissionError,
  ResourceNotFoundError,
  ThreadNotFoundError,
  ValidationError,
} from "./index";
import { FluxyChatError } from "./structured-errors";

describe("adapter error hierarchy (P26-A-4)", () => {
  it("exposes adapter + code on the base error", () => {
    const err = new AdapterError("boom", "slack", "BOOM");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(FluxyChatError);
    expect(err.name).toBe("AdapterError");
    expect(err.adapter).toBe("slack");
    expect(err.code).toBe("BOOM");
    expect(new AdapterError("boom", "slack").code).toBe("ADAPTER_ERROR");
  });

  it("carries retryAfter for backoff", () => {
    const err = new AdapterRateLimitError("slack", 30);
    expect(err).toBeInstanceOf(AdapterError);
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.retryAfter).toBe(30);
    expect(err.message).toBe("Rate limited by slack, retry after 30s");
    expect(new AdapterRateLimitError("slack").message).toBe("Rate limited by slack");
  });

  it("maps authentication, validation and network failures", () => {
    expect(new AuthenticationError("teams").code).toBe("AUTH_FAILED");
    expect(new AuthenticationError("teams").message).toBe("Authentication failed for teams");
    expect(new AuthenticationError("teams", "token revoked").message).toBe("token revoked");

    const validation = new ValidationError("slack", "bad payload");
    expect(validation.code).toBe("VALIDATION_ERROR");
    expect(validation.message).toBe("bad payload");

    const net = new NetworkError("slack", undefined, new Error("ECONNRESET"));
    expect(net.code).toBe("NETWORK_ERROR");
    expect(net.message).toBe("Network error communicating with slack");
    expect(net.originalError?.message).toBe("ECONNRESET");
  });

  it("carries not-found identifiers", () => {
    const res = new ResourceNotFoundError("slack", "channel", "C1");
    expect(res.code).toBe("NOT_FOUND");
    expect(res.resourceType).toBe("channel");
    expect(res.resourceId).toBe("C1");
    expect(res.message).toBe("channel 'C1' not found in slack");
    expect(new ResourceNotFoundError("slack", "channel").message).toBe("channel not found in slack");

    const thread = new ThreadNotFoundError("slack", "T1");
    expect(thread.code).toBe("THREAD_NOT_FOUND");
    expect(thread.threadId).toBe("T1");

    const message = new MessageNotFoundError("slack", "M1");
    expect(message.code).toBe("MESSAGE_NOT_FOUND");
    expect(message.messageId).toBe("M1");

    const ghost = new AdapterNotFoundError("ghost");
    expect(ghost.code).toBe("ADAPTER_NOT_FOUND");
    expect(ghost.adapter).toBe("ghost");
    expect(ghost.message).toBe('Adapter "ghost" not found');
  });

  it("carries permission feedback fields", () => {
    const err = new PermissionError("teams", "send messages", "channels:write");
    expect(err.code).toBe("PERMISSION_DENIED");
    expect(err.action).toBe("send messages");
    expect(err.requiredScope).toBe("channels:write");
    expect(err.message).toBe(
      "Permission denied: cannot send messages in teams (requires: channels:write)",
    );
  });
});
