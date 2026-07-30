/**
 * Provider adapter ports — vendor-neutral boundaries for vertical capabilities.
 * Implementations stay outside the domain layer per ADL.
 */

export interface SfuSessionConfig {
  roomId: string;
  participantId: string;
  role: "host" | "moderator" | "speaker" | "viewer";
}

export interface SfuSession {
  sessionId: string;
  joinUrl: string;
  provider: string;
}

export interface SfuAdapter {
  readonly providerName: string;
  createSession(config: SfuSessionConfig): Promise<SfuSession>;
}

export interface FhirContextRef {
  resourceType: string;
  reference: string;
  display?: string;
}

export interface FhirAdapter {
  readonly providerName: string;
  attachContext(patientId: string, scope: string): Promise<FhirContextRef>;
}

export interface TicketVerificationInput {
  ticketId: string;
  attendeeId: string;
  signature: string;
}

export interface TicketVerificationResult {
  valid: boolean;
  reason?: string;
  provider: string;
}

export interface TicketAdapter {
  readonly providerName: string;
  verify(input: TicketVerificationInput): Promise<TicketVerificationResult>;
}

export interface MarketQuote {
  symbol: string;
  price: number;
  currency: string;
  sequence: number;
  asOf: string;
  stale: boolean;
}

export interface MarketDataAdapter {
  readonly providerName: string;
  getQuote(symbol: string): Promise<MarketQuote>;
}

export const DEMO_ADAPTERS = {
  sfu: {
    providerName: "demo-sfu",
    async createSession(config: SfuSessionConfig): Promise<SfuSession> {
      return {
        sessionId: `sfu_${config.roomId}_${config.participantId}`,
        joinUrl: `https://example.invalid/sfu/${encodeURIComponent(config.roomId)}`,
        provider: "demo-sfu",
      };
    },
  } satisfies SfuAdapter,
  fhir: {
    providerName: "demo-fhir",
    async attachContext(_patientId: string, scope: string): Promise<FhirContextRef> {
      return { resourceType: "Observation", reference: `Observation/${scope}`, display: "Synthetic vitals" };
    },
  } satisfies FhirAdapter,
  ticket: {
    providerName: "demo-ticket",
    async verify(input: TicketVerificationInput): Promise<TicketVerificationResult> {
      const valid = input.signature.length >= 8 && !input.signature.startsWith("revoked");
      return { valid, reason: valid ? undefined : "Invalid signature", provider: "demo-ticket" };
    },
  } satisfies TicketAdapter,
  market: {
    providerName: "demo-market",
    async getQuote(symbol: string): Promise<MarketQuote> {
      return {
        symbol,
        price: 42.5,
        currency: "USD",
        sequence: Date.now(),
        asOf: new Date().toISOString(),
        stale: false,
      };
    },
  } satisfies MarketDataAdapter,
};
