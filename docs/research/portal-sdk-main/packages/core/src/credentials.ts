import type { ResolvedHosts } from "./config.js";
import { getHttpClientFactory } from "./http/factory.js";
import type { HttpClient } from "./http/types.js";
import { classifyRefusal } from "./refusal.js";
import { resolveToken, type TokenSource } from "./token.js";

/** Re-mint a little before the token's own expiry, to absorb clock skew. */
const EXPIRY_SKEW_MS = 30_000;

/** The cached anonymous credential the SDK owns and refreshes on the caller's behalf. */
interface AnonCredential {
  token: string;
  /** Stable identity across refreshes, read from the token's `sub`. */
  anonId: string | undefined;
  /** Epoch ms, or undefined when the token carries no `exp`. */
  expiresAt: number | undefined;
}

/** Read `sub`/`exp` from a JWT payload without verifying it (the client only reads claims). */
export function decodeJwtClaims(token: string): { sub?: string; exp?: number } {
  const payload = token.split(".")[1];
  if (payload === undefined) return {};
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const claims = JSON.parse(atob(padded)) as { sub?: unknown; exp?: unknown };
    return {
      ...(typeof claims.sub === "string" ? { sub: claims.sub } : {}),
      ...(typeof claims.exp === "number" ? { exp: claims.exp } : {}),
    };
  } catch {
    return {};
  }
}

export interface CredentialsDeps {
  hosts: ResolvedHosts;
  apiKey: string;
  token: TokenSource | undefined;
}

/**
 * Owns the connection credential for one Portal instance, shared by reference across every
 * channel and the inbox so a single source drives them all.
 *
 * With a user token it just resolves that token. With no token it runs in anonymous mode:
 * it mints one anonymous JWT on first use, reuses it everywhere, and re-mints on expiry
 * passing the previous `anonId` so the identity is stable across refreshes. Concurrent first
 * uses share one in-flight mint, so many channels connecting at once still mint only once.
 */
export class Credentials {
  readonly #hosts: ResolvedHosts;
  readonly #apiKey: string;
  #userToken: TokenSource | undefined;
  #anon: AnonCredential | undefined;
  #mintInFlight: Promise<string> | undefined;
  #mintClient: HttpClient | undefined;

  constructor(deps: CredentialsDeps) {
    this.#hosts = deps.hosts;
    this.#apiKey = deps.apiKey;
    this.#userToken = deps.token;
  }

  /** True when the SDK owns the credential (anonymous mode); expiry is handled internally. */
  get managed(): boolean {
    return this.#userToken === undefined;
  }

  /** True when the user supplied a static string token (which cannot be re-resolved). */
  get userStatic(): boolean {
    return typeof this.#userToken === "string";
  }

  /** Resolve the current bearer token, minting or refreshing the anonymous credential as needed. */
  readonly resolve = async (): Promise<string> => {
    if (this.#userToken !== undefined) return resolveToken(this.#userToken);
    const anon = this.#anon;
    if (anon !== undefined && (anon.expiresAt === undefined || anon.expiresAt - EXPIRY_SKEW_MS > Date.now())) {
      return anon.token;
    }
    return this.#mint();
  };

  /**
   * Expire the cached anonymous token so the next resolve re-mints — keeping the `anonId` so
   * the identity is stable across the refresh. No-op in user-token mode. Called when the
   * server reports the credential expired.
   */
  invalidate(): void {
    if (this.managed && this.#anon !== undefined) {
      this.#anon = { ...this.#anon, expiresAt: 0 };
    }
  }

  /**
   * Replace the token source. Returns whether the identity changed — a change means active
   * connections must re-authenticate. Supplying a token drops any cached anonymous credential.
   */
  setToken(next: TokenSource | undefined): boolean {
    // Strings compare by value; callbacks and `undefined` by reference/identity.
    const changed = this.#userToken !== next;
    this.#userToken = next;
    if (next !== undefined) this.#anon = undefined;
    return changed;
  }

  #mint(): Promise<string> {
    if (this.#mintInFlight !== undefined) return this.#mintInFlight;
    const anonId = this.#anon?.anonId;
    const inFlight = (async (): Promise<string> => {
      const outcome = await this.#client().mintAnonymousToken(anonId);
      if (!outcome.ok) throw classifyRefusal(outcome.code, outcome.reason).error;
      const { sub, exp } = decodeJwtClaims(outcome.token);
      this.#anon = {
        token: outcome.token,
        anonId: sub ?? anonId,
        expiresAt: exp !== undefined ? exp * 1000 : undefined,
      };
      return outcome.token;
    })();
    this.#mintInFlight = inFlight;
    void inFlight.catch(() => undefined).finally(() => {
      if (this.#mintInFlight === inFlight) this.#mintInFlight = undefined;
    });
    return inFlight;
  }

  #client(): HttpClient {
    if (this.#mintClient === undefined) {
      this.#mintClient = getHttpClientFactory()({
        httpUrl: this.#hosts.apiUrl,
        apiKey: this.#apiKey,
        // The mint route authenticates by apiKey only and never resolves a bearer token.
        token: () => Promise.reject(new Error("the mint route does not use a bearer token")),
      });
    }
    return this.#mintClient;
  }
}
