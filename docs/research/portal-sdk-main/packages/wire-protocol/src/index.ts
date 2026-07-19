/**
 * `@portalsdk/wire-protocol` — the canonical definition of the Portal wire protocol v1.
 *
 * Types and pure guards only: no runtime dependencies, no I/O, no classes, no state.
 * This is the transport layer, one level BELOW the SDK's public types — `t`, `seq`, and
 * frame shapes live here and are stripped at the SDK edge.
 *
 * The `§`-markers throughout the source (§1.2, §2.1, …) refer to the Portal wire
 * protocol v1 specification.
 */

export * from "./constants.js";
export * from "./errors.js";
export * from "./message.js";
export * from "./channel.js";
export * from "./inbox.js";
export * from "./http.js";
export * from "./frames.js";
export * from "./parse.js";
