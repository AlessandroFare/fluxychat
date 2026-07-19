import type {
  PresenceFrame,
  ReadyPresence,
  WirePresenceParticipant,
} from "@portalsdk/wire-protocol";

import type { AggregatePresence, DetailedPresence } from "./types.js";

type PublicParticipant = DetailedPresence["participants"][number];

/** Wire → public participant. As of wire-protocol 0.3.0 the shapes match, so this is a copy. */
function toPublic(p: WirePresenceParticipant): PublicParticipant {
  return {
    id: p.id,
    anon: p.anon,
    ...(p.username !== undefined ? { username: p.username } : {}),
    ...(p.metadata !== undefined ? { metadata: p.metadata } : {}),
  };
}

/**
 * Tracks a channel's presence across the connect snapshot and deltas, and produces the
 * public presence value (discriminated on `kind`, mapped from the wire's `mode`).
 *
 * Detailed presence keeps a roster keyed by participant id: `joined` adds or replaces (so
 * re-announced metadata updates in place), `left` removes by id. Aggregate presence carries
 * only a count and a recent-activity list — there is no roster.
 */
export class PresenceTracker {
  readonly #roster = new Map<string, PublicParticipant>();
  #kind: "detailed" | "aggregate" | undefined;
  #count = 0;
  #recent: AggregatePresence["recent"] = [];

  /** Seed from the `ready` snapshot. */
  seed(snapshot: ReadyPresence): void {
    if (snapshot.mode === "detailed") {
      this.#kind = "detailed";
      this.#roster.clear();
      for (const p of snapshot.participants) this.#roster.set(p.id, toPublic(p));
      this.#count = snapshot.count;
    } else {
      this.#kind = "aggregate";
      this.#count = snapshot.count;
      this.#recent = asRecent(snapshot.recent);
    }
  }

  /** Apply a presence delta. */
  applyDelta(frame: PresenceFrame): void {
    if (frame.mode === "detailed") {
      this.#kind = "detailed";
      for (const p of frame.joined) this.#roster.set(p.id, toPublic(p));
      for (const id of frame.left) this.#roster.delete(id);
      this.#count = frame.count;
    } else {
      this.#kind = "aggregate";
      this.#count = frame.count;
      this.#recent = asRecent(frame.recent);
    }
  }

  /** The current public presence, or undefined before any snapshot/delta. */
  current(): DetailedPresence | AggregatePresence | undefined {
    if (this.#kind === "detailed") {
      return {
        kind: "detailed",
        participants: [...this.#roster.values()],
        count: this.#count,
      };
    }
    if (this.#kind === "aggregate") {
      return { kind: "aggregate", count: this.#count, recent: this.#recent };
    }
    return undefined;
  }

  reset(): void {
    this.#roster.clear();
    this.#kind = undefined;
    this.#count = 0;
    this.#recent = [];
  }
}

/**
 * SPEC: the wire types `recent` as `unknown[]` — no fixture covers aggregate (broadcast)
 * presence, so its element shape is unproven. The server's entries are passed through
 * untouched (never fabricated); if the server sends the contract's `{ id, action, at }`
 * they surface as-is.
 */
function asRecent(recent: unknown[] | undefined): AggregatePresence["recent"] {
  return (recent ?? []) as AggregatePresence["recent"];
}
