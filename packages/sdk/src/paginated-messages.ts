import type { FetchMessagesOptions, FluxyChatMessage } from "./fluxy-chat-client";

/** Ably `OrderBy`: newestFirst is the history default. */
export type FluxyHistoryOrder = "newestFirst" | "oldestFirst";

export interface FluxyHistoryParams {
  limit?: number;
  /** ISO createdAt cursor: older than this timestamp. */
  before?: string;
  /** Inclusive lower bound (ISO or epoch ms). */
  start?: string | number;
  after?: string;
  /** Exclusive upper bound (ISO or epoch ms). */
  end?: string | number;
  /** Rewind-lite: exclusive lower bound on numeric message id. */
  fromSerial?: string | number;
  /** Exclusive older bound on numeric message id (`id < n`). */
  beforeSerial?: string | number;
  orderBy?: FluxyHistoryOrder;
}

export interface FluxyPaginatedResult<T> {
  items: T[];
  hasNext(): boolean;
  isLast(): boolean;
  next(): Promise<FluxyPaginatedResult<T> | null>;
  first(): Promise<FluxyPaginatedResult<T>>;
  current(): Promise<FluxyPaginatedResult<T>>;
}

const DEFAULT_HISTORY_LIMIT = 100;

export function singlePageResult<T>(items: T[]): FluxyPaginatedResult<T> {
  const page: FluxyPaginatedResult<T> = {
    items,
    hasNext() {
      return false;
    },
    isLast() {
      return true;
    },
    async next() {
      return null;
    },
    first() {
      return Promise.resolve(page);
    },
    current() {
      return Promise.resolve(page);
    },
  };
  return page;
}

export async function fetchMessageHistoryPage(
  fetchPage: (options: FetchMessagesOptions) => Promise<FluxyChatMessage[]>,
  params: FluxyHistoryParams = {},
  firstParams: FluxyHistoryParams = params,
): Promise<FluxyPaginatedResult<FluxyChatMessage>> {
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_HISTORY_LIMIT, 1), 500);
  const chronological = await fetchPage({
    limit,
    ...(params.before ? { before: params.before } : {}),
    ...(params.after ? { after: params.after } : {}),
    ...(params.start != null ? { start: params.start } : {}),
    ...(params.end != null ? { end: params.end } : {}),
    ...(params.fromSerial != null ? { fromSerial: params.fromSerial } : {}),
    ...(params.beforeSerial != null ? { beforeSerial: params.beforeSerial } : {}),
  });
  const orderBy: FluxyHistoryOrder = params.orderBy ?? "newestFirst";
  const items =
    orderBy === "newestFirst" ? [...chronological].reverse() : chronological;
  const oldest = chronological[0];
  const hasMore = chronological.length >= limit && oldest?.id != null;

  const page: FluxyPaginatedResult<FluxyChatMessage> = {
    items,
    hasNext() {
      return hasMore;
    },
    isLast() {
      return !hasMore;
    },
    async next() {
      if (!hasMore || oldest?.id == null) return null;
      return fetchMessageHistoryPage(
        fetchPage,
        { ...params, limit, beforeSerial: oldest.id, orderBy },
        firstParams,
      );
    },
    first() {
      return fetchMessageHistoryPage(fetchPage, { ...firstParams, limit: firstParams.limit ?? limit }, firstParams);
    },
    current() {
      return Promise.resolve(page);
    },
  };
  return page;
}
