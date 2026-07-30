import type {
  HistoryResponse,
  MembersResponse,
  PublishBody,
} from "@portalsdk/wire-protocol";

import type {
  HttpClient,
  HttpClientFactory,
  HistoryQuery,
  MintOutcome,
  PublishOutcome,
} from "../../src/http/types.js";

/** Base64url-encode a JSON value (no padding), for building fake JWTs. */
function base64url(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Build an unsigned fake JWT carrying the given claims — enough for the client to read `sub`/`exp`. */
export function fakeJwt(claims: Record<string, unknown>): string {
  return `${base64url({ alg: "none", typ: "JWT" })}.${base64url(claims)}.sig`;
}

export interface MockHttpOptions {
  onPublish?: (channelId: string, body: PublishBody) => PublishOutcome;
  onHistory?: (channelId: string, query: HistoryQuery) => HistoryResponse;
  onMembers?: (channelId: string, cursor: string | undefined) => MembersResponse;
  onMint?: (anonId: string | undefined) => MintOutcome;
}

/**
 * In-memory {@link HttpClient} for the message plane. It records every call and answers
 * from optional handlers, defaulting to an accepted publish and an empty history page. It
 * deliberately does not resolve the token, so socket-side token resolution can be asserted
 * in isolation.
 */
export class MockHttpClient implements HttpClient {
  readonly publishCalls: { channelId: string; body: PublishBody }[] = [];
  readonly historyCalls: { channelId: string; query: HistoryQuery }[] = [];
  readonly memberCalls: { channelId: string; cursor: string | undefined }[] = [];
  readonly mintCalls: { anonId: string | undefined }[] = [];

  readonly #options: MockHttpOptions;

  constructor(options: MockHttpOptions = {}) {
    this.#options = options;
  }

  publish(channelId: string, body: PublishBody): Promise<PublishOutcome> {
    this.publishCalls.push({ channelId, body });
    const outcome =
      this.#options.onPublish?.(channelId, body) ??
      ({
        ok: true,
        ack: { id: `srv_${this.publishCalls.length}`, seq: 0, timestamp: 0 },
      } satisfies PublishOutcome);
    return Promise.resolve(outcome);
  }

  history(channelId: string, query: HistoryQuery): Promise<HistoryResponse> {
    this.historyCalls.push({ channelId, query });
    const page = this.#options.onHistory?.(channelId, query) ?? { msgs: [], hasMore: false };
    return Promise.resolve(page);
  }

  members(channelId: string, cursor?: string): Promise<MembersResponse> {
    this.memberCalls.push({ channelId, cursor });
    const page = this.#options.onMembers?.(channelId, cursor) ?? { members: [] };
    return Promise.resolve(page);
  }

  mintAnonymousToken(anonId?: string): Promise<MintOutcome> {
    this.mintCalls.push({ anonId });
    // Default: reuse the passed anonId (or a fresh one) so identity is stable across re-mints;
    // a far-future exp keeps the token cached rather than immediately re-minting.
    const outcome =
      this.#options.onMint?.(anonId) ??
      ({ ok: true, token: fakeJwt({ sub: anonId ?? "anon_1", exp: 4_102_444_800 }) } satisfies MintOutcome);
    return Promise.resolve(outcome);
  }

  /** A factory that always returns this instance, for `setHttpClientFactory`. */
  get factory(): HttpClientFactory {
    return () => this;
  }
}
