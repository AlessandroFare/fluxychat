import { decodeFluxyJwtPayload } from "./jwt-utils";

/** Re-mint slightly before expiry to absorb clock skew (Portal parity). */
const EXPIRY_SKEW_MS = 30_000;

export type FluxyTokenSource = string | (() => string | Promise<string>);

interface AnonCredential {
  token: string;
  anonId: string | undefined;
  expiresAt: number | undefined;
}

export interface FluxyClientCredentialsOptions {
  baseUrl: string;
  apiKey: string;
  /** Initial bearer token or async provider. Omit to enable anonymous auto-mint. */
  token?: FluxyTokenSource;
}

/**
 * Owns the connection credential for one {@link FluxyChatClient} instance.
 * With apiKey only, mints anonymous JWT via POST /tokens/anonymous.
 */
export class FluxyClientCredentials {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private userToken: FluxyTokenSource | undefined;
  private cachedToken: string | undefined;
  private anon: AnonCredential | undefined;
  private mintInFlight: Promise<string> | undefined;

  constructor(options: FluxyClientCredentialsOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.userToken = options.token;
    if (typeof options.token === "string") {
      this.cachedToken = options.token;
    }
  }

  /** True when the SDK owns credential lifecycle (anonymous auto-mint). */
  get managed(): boolean {
    return this.userToken === undefined;
  }

  /** True when the user supplied a static string token. */
  get userStatic(): boolean {
    return typeof this.userToken === "string";
  }

  getCachedToken(): string | undefined {
    return this.cachedToken;
  }

  /** Synchronous identity hint before first resolve (constructor userId or anon sub). */
  getResolvedUserId(fallback: string): string {
    if (this.cachedToken) {
      const sub = decodeFluxyJwtPayload(this.cachedToken).sub;
      if (sub) return sub;
    }
    return this.anon?.anonId ?? fallback;
  }

  async resolve(): Promise<string> {
    if (this.userToken !== undefined) {
      const token =
        typeof this.userToken === "function" ? await this.userToken() : this.userToken;
      this.cachedToken = token;
      return token;
    }

    const anon = this.anon;
    if (
      anon !== undefined &&
      (anon.expiresAt === undefined || anon.expiresAt - EXPIRY_SKEW_MS > Date.now())
    ) {
      this.cachedToken = anon.token;
      return anon.token;
    }

    return this.mint();
  }

  invalidate(): void {
    if (this.managed && this.anon !== undefined) {
      this.anon = { ...this.anon, expiresAt: 0 };
    }
  }

  /**
   * Replace token source. Returns whether identity likely changed (connections should re-auth).
   */
  setToken(next: FluxyTokenSource | undefined): boolean {
    const prevSub = this.cachedToken ? decodeFluxyJwtPayload(this.cachedToken).sub : undefined;
    this.userToken = next;
    this.anon = undefined;
    this.mintInFlight = undefined;
    if (typeof next === "string") {
      this.cachedToken = next;
    } else if (next === undefined) {
      this.cachedToken = undefined;
    } else {
      this.cachedToken = undefined;
    }
    const nextSub =
      typeof next === "string" ? decodeFluxyJwtPayload(next).sub : undefined;
    return prevSub !== nextSub;
  }

  private mint(): Promise<string> {
    if (this.mintInFlight !== undefined) return this.mintInFlight;

    const anonId = this.anon?.anonId;
    const inFlight = (async (): Promise<string> => {
      const res = await fetch(`${this.baseUrl}/tokens/anonymous`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Fluxy-Api-Key": this.apiKey,
        },
        body: JSON.stringify(anonId ? { anonId } : {}),
      });
      if (!res.ok) {
        let code = "mint_failed";
        try {
          const body = (await res.json()) as { code?: string; error?: string };
          code = body.code ?? body.error ?? code;
        } catch {
          /* ignore */
        }
        throw new Error(`anonymous token mint failed: ${code}`);
      }
      const body = (await res.json()) as { token: string; userId?: string };
      const { sub, exp } = decodeFluxyJwtPayload(body.token);
      this.anon = {
        token: body.token,
        anonId: sub ?? body.userId ?? anonId,
        expiresAt: exp !== undefined ? exp * 1000 : undefined,
      };
      this.cachedToken = body.token;
      return body.token;
    })();

    this.mintInFlight = inFlight;
    void inFlight.catch(() => undefined).finally(() => {
      if (this.mintInFlight === inFlight) this.mintInFlight = undefined;
    });
    return inFlight;
  }
}
