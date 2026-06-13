import { describe, it, expect } from "vitest";
import {
  isIpAllowed,
  addWhitelistRule,
  removeWhitelistRule,
  listWhitelistRules,
  toggleWhitelistRule,
  checkIpAccess,
  getWhitelistStats,
} from "./ip-whitelist.js";

function makeEnv() {
  const store = [];
  return {
    DB: {
      prepare: (sql) => ({
        bind: (...params) => ({
          first: async () => {
            if (sql.includes("GROUP BY")) {
              const counts = { total: 0, enabled: 0, disabled: 0 };
              for (const r of store.filter((r) => r.project_id === params[0])) {
                counts.total++;
                if (r.enabled) counts.enabled++;
                else counts.disabled++;
              }
              return counts;
            }
            return null;
          },
          all: async () => {
            if (sql.includes("GROUP BY")) {
              const counts = {};
              for (const r of store.filter((r) => r.project_id === params[0])) {
                const key = r.enabled ? "1" : "0";
                counts[key] = (counts[key] || 0) + 1;
              }
              return { results: Object.entries(counts).map(([k, v]) => ({ enabled: Number(k), count: v })) };
            }
            return { results: store.filter((r) => r.project_id === params[0]) };
          },
          run: async () => {
            if (sql.includes("INSERT")) {
              const exists = store.find((r) => r.project_id === params[1] && r.ip_address === params[2] && r.cidr_prefix === params[3]);
              if (exists) throw new Error("UNIQUE constraint");
              store.push({ id: params[0], project_id: params[1], ip_address: params[2], cidr_prefix: params[3], label: params[4], enabled: params[5], created_at: params[6] });
            } else if (sql.includes("DELETE")) {
              const before = store.length;
              for (let i = store.length - 1; i >= 0; i--) {
                if (store[i].id === params[0]) store.splice(i, 1);
              }
              return { meta: { changes: before - store.length } };
            } else if (sql.includes("UPDATE")) {
              const idx = store.findIndex((r) => r.id === params[1]);
              if (idx >= 0) store[idx].enabled = params[0];
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            return { meta: { changes: 1 } };
          },
        }),
      }),
    },
    _store: store,
  };
}

describe("ip-whitelist", () => {
  describe("isIpAllowed", () => {
    it("allows all when no rules", () => {
      expect(isIpAllowed("1.2.3.4", [])).toBe(true);
    });

    it("matches exact IP", () => {
      const rules = [{ ip_address: "1.2.3.4", cidr_prefix: null, enabled: true }];
      expect(isIpAllowed("1.2.3.4", rules)).toBe(true);
      expect(isIpAllowed("1.2.3.5", rules)).toBe(false);
    });

    it("matches CIDR range", () => {
      const rules = [{ ip_address: "10.0.0.0", cidr_prefix: 8, enabled: true }];
      expect(isIpAllowed("10.1.2.3", rules)).toBe(true);
      expect(isIpAllowed("10.255.255.255", rules)).toBe(true);
      expect(isIpAllowed("11.0.0.1", rules)).toBe(false);
    });

    it("handles /32 single host", () => {
      const rules = [{ ip_address: "192.168.1.1", cidr_prefix: 32, enabled: true }];
      expect(isIpAllowed("192.168.1.1", rules)).toBe(true);
      expect(isIpAllowed("192.168.1.2", rules)).toBe(false);
    });

    it("handles /24 subnet", () => {
      const rules = [{ ip_address: "192.168.1.0", cidr_prefix: 24, enabled: true }];
      expect(isIpAllowed("192.168.1.100", rules)).toBe(true);
      expect(isIpAllowed("192.168.2.1", rules)).toBe(false);
    });

    it("skips disabled rules", () => {
      const rules = [{ ip_address: "1.2.3.4", cidr_prefix: null, enabled: false }];
      expect(isIpAllowed("1.2.3.4", rules)).toBe(false);
    });

    it("returns false for null clientIp", () => {
      const rules = [{ ip_address: "1.2.3.4", cidr_prefix: null, enabled: true }];
      expect(isIpAllowed(null, rules)).toBe(false);
    });

    it("handles IPv6 mapped IPv4", () => {
      const rules = [{ ip_address: "1.2.3.4", cidr_prefix: null, enabled: true }];
      expect(isIpAllowed("::ffff:1.2.3.4", rules)).toBe(true);
    });
  });

  describe("addWhitelistRule", () => {
    it("creates a rule", async () => {
      const env = makeEnv();
      const result = await addWhitelistRule(env, { projectId: "p1", ipAddress: "10.0.0.1" });
      expect(result.created).toBe(true);
    });

    it("requires ipAddress", async () => {
      const env = makeEnv();
      const result = await addWhitelistRule(env, { projectId: "p1" });
      expect(result.error).toContain("ipAddress");
    });

    it("rejects invalid IP", async () => {
      const env = makeEnv();
      const result = await addWhitelistRule(env, { projectId: "p1", ipAddress: "999.999.999.999" });
      expect(result.error).toContain("invalid");
    });

    it("rejects duplicate", async () => {
      const env = makeEnv();
      await addWhitelistRule(env, { projectId: "p1", ipAddress: "10.0.0.1" });
      const result = await addWhitelistRule(env, { projectId: "p1", ipAddress: "10.0.0.1" });
      expect(result.error).toContain("already_exists");
    });
  });

  describe("checkIpAccess", () => {
    it("allows when no rules", async () => {
      const env = makeEnv();
      const result = await checkIpAccess(env, { projectId: "p1", clientIp: "1.2.3.4" });
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("no_rules");
    });

    it("allows when IP matches", async () => {
      const env = makeEnv();
      await addWhitelistRule(env, { projectId: "p1", ipAddress: "10.0.0.1" });
      const result = await checkIpAccess(env, { projectId: "p1", clientIp: "10.0.0.1" });
      expect(result.allowed).toBe(true);
    });

    it("blocks when IP doesn't match", async () => {
      const env = makeEnv();
      await addWhitelistRule(env, { projectId: "p1", ipAddress: "10.0.0.1" });
      const result = await checkIpAccess(env, { projectId: "p1", clientIp: "192.168.1.1" });
      expect(result.allowed).toBe(false);
    });
  });

  describe("getWhitelistStats", () => {
    it("returns stats", async () => {
      const env = makeEnv();
      await addWhitelistRule(env, { projectId: "p1", ipAddress: "10.0.0.1" });
      await addWhitelistRule(env, { projectId: "p1", ipAddress: "10.0.0.2" });
      const stats = await getWhitelistStats(env, { projectId: "p1" });
      expect(stats.total).toBe(2);
      expect(stats.enabled).toBe(2);
    });
  });
});
