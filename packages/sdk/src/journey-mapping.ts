export interface JourneyStep {
  id: string;
  channel: string;
  action: string;
  timestamp: number;
  durationMs?: number;
  metadata: Record<string, unknown>;
}

export interface CustomerJourney {
  userId: string;
  steps: JourneyStep[];
  startTime: number;
  endTime?: number;
  totalDurationMs?: number;
  channelSequence: string[];
  touchpointCount: number;
}

export interface JourneyPath {
  from: string;
  to: string;
  count: number;
  avgDurationMs: number;
}

export interface JourneyMapping {
  recordStep(userId: string, step: Omit<JourneyStep, "id">): JourneyStep;
  getJourney(userId: string): CustomerJourney | undefined;
  listJourneys(limit?: number): CustomerJourney[];
  getPaths(minTransitions?: number): JourneyPath[];
  getChannelSequence(userId: string): string[];
  getAverageStepsPerJourney(): number;
  clearUserJourney(userId: string): void;
}

/** CodeQL-safe step id — crypto.getRandomValues only (see js/insecure-randomness). */
function createJourneyStepId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `step-${suffix}`;
}

export function createJourneyMapping(): JourneyMapping {
  const journeys = new Map<string, CustomerJourney>();

  return {
    recordStep(userId, input) {
      const id = createJourneyStepId();
      const step: JourneyStep = { ...input, id };

      let journey = journeys.get(userId);
      if (!journey) {
        journey = {
          userId,
          steps: [],
          startTime: input.timestamp,
          channelSequence: [],
          touchpointCount: 0,
        };
        journeys.set(userId, journey);
      }

      journey.steps.push(step);
      journey.endTime = input.timestamp;
      journey.totalDurationMs = journey.endTime - journey.startTime;
      journey.touchpointCount = journey.steps.length;

      const channels = new Set(journey.channelSequence);
      if (!channels.has(input.channel)) {
        journey.channelSequence.push(input.channel);
      }

      return { ...step };
    },

    getJourney(userId) {
      const j = journeys.get(userId);
      return j ? { ...j, steps: [...j.steps] } : undefined;
    },

    listJourneys(limit = 50) {
      return Array.from(journeys.values())
        .sort((a, b) => (b.endTime ?? 0) - (a.endTime ?? 0))
        .slice(0, limit)
        .map((j) => ({ ...j, steps: [...j.steps] }));
    },

    getPaths(minTransitions = 1) {
      const transitionCount = new Map<string, { count: number; durations: number[] }>();
      for (const j of journeys.values()) {
        for (let i = 0; i < j.steps.length - 1; i++) {
          const key = `${j.steps[i].channel}:${j.steps[i + 1].channel}`;
          if (!transitionCount.has(key)) transitionCount.set(key, { count: 0, durations: [] });
          const t = transitionCount.get(key)!;
          t.count++;
          if (j.steps[i].durationMs) t.durations.push(j.steps[i].durationMs!);
        }
      }
      return Array.from(transitionCount.entries())
        .filter(([, t]) => t.count >= minTransitions)
        .map(([key, t]) => ({
          from: key.split(":")[0],
          to: key.split(":")[1],
          count: t.count,
          avgDurationMs: t.durations.length > 0
            ? t.durations.reduce((a, b) => a + b, 0) / t.durations.length
            : 0,
        }));
    },

    getChannelSequence(userId) {
      const j = journeys.get(userId);
      return j ? [...j.channelSequence] : [];
    },

    getAverageStepsPerJourney() {
      if (journeys.size === 0) return 0;
      const total = Array.from(journeys.values()).reduce((sum, j) => sum + j.steps.length, 0);
      return total / journeys.size;
    },

    clearUserJourney(userId) {
      journeys.delete(userId);
    },
  };
}
