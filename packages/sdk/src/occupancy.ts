export interface FluxyOccupancyData {
  connections: number;
  presenceMembers: number;
  /** Extra sockets beyond presence members (Ably kit “watching”). */
  watching: number;
}

export function watchingFromOccupancyCounts(connections: number, presenceMembers: number): number {
  return Math.max(0, connections - presenceMembers);
}

function occupancyData(connections: number, presenceMembers: number): FluxyOccupancyData {
  return {
    connections,
    presenceMembers,
    watching: watchingFromOccupancyCounts(connections, presenceMembers),
  };
}

/** Ably occupancy.subscribe payload: counts nested under `occupancy`. */
export interface FluxyOccupancyEvent {
  type: "occupancy.updated";
  occupancy: FluxyOccupancyData;
}

export function occupancyFromEvent(event: {
  connections?: number;
  presenceMembers?: number;
}): FluxyOccupancyData {
  return occupancyData(Number(event.connections) || 0, Number(event.presenceMembers) || 0);
}

export function occupancyEventFromData(data: FluxyOccupancyData): FluxyOccupancyEvent {
  return { type: "occupancy.updated", occupancy: occupancyFromEvent(data) };
}

export function occupancyFromLive(input: {
  subscriptionCount?: number;
  userCount?: number;
  members?: Array<{ userId: string }>;
  online?: number;
}): FluxyOccupancyData {
  const members = Array.isArray(input.members) ? input.members.length : 0;
  return occupancyData(
    Number(input.subscriptionCount ?? input.online ?? 0) || 0,
    Number(input.userCount ?? members) || 0,
  );
}

/** Ably occupancy.current is a getter; we also keep `current()` for existing callers. */
export type FluxyOccupancyCurrent = (() => FluxyOccupancyData | null) & FluxyOccupancyData;

export function occupancyCurrentFn(read: () => FluxyOccupancyData | null): FluxyOccupancyCurrent {
  const fn = (() => read()) as FluxyOccupancyCurrent;
  return new Proxy(fn, {
    get(target, prop, receiver) {
      if (prop === "connections" || prop === "presenceMembers" || prop === "watching") {
        const data = read();
        if (!data) return 0;
        if (prop === "watching") {
          return data.watching ?? watchingFromOccupancyCounts(data.connections, data.presenceMembers);
        }
        return data[prop] ?? 0;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
