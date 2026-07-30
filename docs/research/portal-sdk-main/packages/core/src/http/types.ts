import type {
  HistoryResponse,
  MembersResponse,
  PublishBody,
  SendAckWire,
} from "@portalsdk/wire-protocol";

/**
 * The HTTP seam.
 *
 * Persistent publishes, history paging, and gap-fill ranges all go over HTTP (§3). The
 * message plane programs against {@link HttpClient}; production supplies a `fetch`-backed
 * client, tests an in-memory mock.
 */

/** A publish either succeeds with the wire ack or is rejected with a code (§3.1). */
export type PublishOutcome =
  | { ok: true; ack: SendAckWire }
  | { ok: false; code: string; reason?: string };

/** An anonymous-token mint either returns the signed token or is rejected with a code. */
export type MintOutcome =
  | { ok: true; token: string }
  | { ok: false; code: string; reason?: string };

/** History query — scroll-up paging (`before`/`limit`) or a gap-fill range (`from`/`to`). */
export interface HistoryQuery {
  before?: number;
  limit?: number;
  from?: number;
  to?: number;
}

export interface HttpClient {
  /** `POST /v1/channels/{id}/messages` (§3.1). Network errors reject; 4xx resolve `ok:false`. */
  publish(channelId: string, body: PublishBody): Promise<PublishOutcome>;
  /** `GET /v1/channels/{id}/history` (§3.2). */
  history(channelId: string, query: HistoryQuery): Promise<HistoryResponse>;
  /** `GET /v1/channels/{id}/members` (§3.3), one page per cursor. */
  members(channelId: string, cursor?: string): Promise<MembersResponse>;
  /**
   * `POST /v1/tokens/anonymous`. Mints an anonymous session token, authenticated by the
   * publishable `apiKey` alone (no bearer). Passing `anonId` re-mints for the same identity.
   */
  mintAnonymousToken(anonId?: string): Promise<MintOutcome>;
}

export interface HttpClientDeps {
  /** HTTP origin this client sends every request to (no trailing slash). */
  httpUrl: string;
  apiKey: string;
  token: import("../token.js").TokenSource;
}

/** Creates an {@link HttpClient} bound to a set of credentials and hosts. */
export type HttpClientFactory = (deps: HttpClientDeps) => HttpClient;
