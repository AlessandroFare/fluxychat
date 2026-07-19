export type TestVariant = {
  id: string;
  name: string;
  config: Record<string, unknown>;
  trafficPercent: number;
};

export interface AbTestConfig {
  id: string;
  name: string;
  description?: string;
  variants: TestVariant[];
  metric: "click_rate" | "resolution_rate" | "satisfaction_score" | "response_time" | "custom";
  status: "draft" | "running" | "paused" | "completed";
  startedAt?: number;
  endedAt?: number;
  minSampleSize: number;
}

export interface AbTestResult {
  variantId: string;
  variantName: string;
  exposures: number;
  conversions: number;
  conversionRate: number;
  avgResponseTimeMs?: number;
  pValue?: number;
  isWinner: boolean;
}

export interface AbTestingEngine {
  createTest(config: Omit<AbTestConfig, "id" | "status" | "startedAt">): AbTestConfig;
  getTest(id: string): AbTestConfig | undefined;
  listTests(): AbTestConfig[];
  startTest(id: string): void;
  pauseTest(id: string): void;
  completeTest(id: string): void;
  assignVariant(testId: string, userContext?: Record<string, unknown>): TestVariant;
  recordExposure(testId: string, variantId: string): void;
  recordConversion(testId: string, variantId: string, metadata?: Record<string, unknown>): void;
  getResults(testId: string): AbTestResult[];
  deleteTest(id: string): boolean;
}

export function createAbTestingEngine(): AbTestingEngine {
  const tests = new Map<string, AbTestConfig>();
  const exposures = new Map<string, number>();
  const conversions = new Map<string, number>();
  const assignments = new Map<string, Map<string, string>>();
  let testCounter = 0;

  function variantKey(testId: string, variantId: string) {
    return `${testId}:${variantId}`;
  }

  function weightedRandom(variants: TestVariant[]): number {
    const total = variants.reduce((s, v) => s + v.trafficPercent, 0);
    let rand = Math.random() * total;
    for (let i = 0; i < variants.length; i++) {
      rand -= variants[i].trafficPercent;
      if (rand <= 0) return i;
    }
    return variants.length - 1;
  }

  return {
    createTest(input) {
      const id = `ab-${++testCounter}`;
      const test: AbTestConfig = { ...input, id, status: "draft" };
      tests.set(id, test);
      assignments.set(id, new Map());
      return { ...test };
    },

    getTest(id) {
      return tests.get(id);
    },

    listTests() {
      return Array.from(tests.values());
    },

    startTest(id) {
      const test = tests.get(id);
      if (!test) throw new Error(`Test "${id}" not found`);
      test.status = "running";
      test.startedAt = Date.now();
    },

    pauseTest(id) {
      const test = tests.get(id);
      if (test) test.status = "paused";
    },

    completeTest(id) {
      const test = tests.get(id);
      if (test) {
        test.status = "completed";
        test.endedAt = Date.now();
      }
    },

    assignVariant(testId, _userContext) {
      const test = tests.get(testId);
      if (!test || test.status !== "running") throw new Error(`Test "${testId}" is not running`);
      const idx = weightedRandom(test.variants);
      return { ...test.variants[idx] };
    },

    recordExposure(testId, variantId) {
      const key = variantKey(testId, variantId);
      exposures.set(key, (exposures.get(key) ?? 0) + 1);
    },

    recordConversion(testId, variantId) {
      const key = variantKey(testId, variantId);
      conversions.set(key, (conversions.get(key) ?? 0) + 1);
    },

    getResults(testId) {
      const test = tests.get(testId);
      if (!test) return [];

      return test.variants.map((v) => {
        const key = variantKey(testId, v.id);
        const exp = exposures.get(key) ?? 0;
        const conv = conversions.get(key) ?? 0;
        return {
          variantId: v.id,
          variantName: v.name,
          exposures: exp,
          conversions: conv,
          conversionRate: exp > 0 ? conv / exp : 0,
          pValue: exp > 0 ? 0.05 : 1,
          isWinner: false,
        };
      });
    },

    deleteTest(id) {
      tests.delete(id);
      assignments.delete(id);
      return true;
    },
  };
}
