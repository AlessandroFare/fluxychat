import { describe, it, expect } from "vitest";
import {
  getProviderInfo,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  listIntegrations,
  getIntegration,
  buildScanPayload,
  parseScanResponse,
  getDlpIntegrationStats,
} from "./dlp-integrations.js";

function makeEnv() {
  const integrations = [];
  const scans = [];
  return {
    DB: {
      prepare: (sql) => ({
        bind: (...params) => ({
          first: async () => {
            if (sql.includes("dlp_integrations") && !sql.includes("GROUP BY")) {
              return integrations.find((i) => i.id === params[0] && i.project_id === params[1]) || null;
            }
            return null;
          },
          all: async () => {
            if (sql.includes("GROUP BY")) {
              const groups = {};
              for (const i of integrations.filter((i) => i.project_id === params[0])) {
                const key = i.provider;
                if (!groups[key]) groups[key] = { provider: key, enabled: 0, disabled: 0, scan_count: 0 };
                if (i.enabled) groups[key].enabled++;
                else groups[key].disabled++;
                groups[key].scan_count += i.scan_count;
              }
              return { results: Object.values(groups) };
            }
            return { results: integrations.filter((i) => i.project_id === params[0]) };
          },
          run: async () => {
            if (sql.includes("INSERT INTO dlp_integrations")) {
              integrations.push({
                id: params[0], project_id: params[1], name: params[2], provider: params[3],
                endpoint_url: params[4], api_key_encrypted: params[5], config: params[6],
                enabled: params[7], scan_count: params[8], created_at: params[9], updated_at: params[10],
                last_scan_at: null,
              });
            } else if (sql.includes("DELETE")) {
              const before = integrations.length;
              for (let i = integrations.length - 1; i >= 0; i--) {
                if (integrations[i].id === params[0] && integrations[i].project_id === params[1]) integrations.splice(i, 1);
              }
              return { meta: { changes: before - integrations.length } };
            } else if (sql.includes("UPDATE")) {
              const idx = integrations.findIndex((i) => i.id === params[params.length - 2] && i.project_id === params[params.length - 1]);
              if (idx >= 0) {
                if (sql.includes("enabled = ?")) integrations[idx].enabled = params[0];
                if (sql.includes("scan_count")) integrations[idx].scan_count++;
              }
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            return { meta: { changes: 1 } };
          },
        }),
      }),
    },
    _integrations: integrations,
  };
}

describe("dlp-integrations", () => {
  describe("getProviderInfo", () => {
    it("returns info for known providers", () => {
      expect(getProviderInfo("microsoft_purview")).toBeDefined();
      expect(getProviderInfo("symantec")).toBeDefined();
      expect(getProviderInfo("forcepoint")).toBeDefined();
      expect(getProviderInfo("custom_webhook")).toBeDefined();
    });

    it("returns null for unknown", () => {
      expect(getProviderInfo("unknown")).toBeNull();
    });
  });

  describe("createIntegration", () => {
    it("creates an integration", async () => {
      const env = makeEnv();
      const result = await createIntegration(env, {
        projectId: "p1", name: "Purview", provider: "microsoft_purview", endpointUrl: "https://purview.example.com",
      });
      expect(result.created).toBe(true);
    });

    it("requires name, provider, endpointUrl", async () => {
      const env = makeEnv();
      const result = await createIntegration(env, { projectId: "p1" });
      expect(result.error).toContain("required");
    });

    it("validates provider", async () => {
      const env = makeEnv();
      const result = await createIntegration(env, { projectId: "p1", name: "x", provider: "invalid", endpointUrl: "https://x.com" });
      expect(result.error).toContain("provider");
    });
  });

  describe("buildScanPayload", () => {
    it("builds Microsoft Purview payload", () => {
      const payload = buildScanPayload("microsoft_purview", { messageId: "m1", roomId: "r1", content: "test" });
      expect(payload.ScanRequest).toBeDefined();
      expect(payload.ScanRequest.Content).toBe("test");
    });

    it("builds Symantec payload", () => {
      const payload = buildScanPayload("symantec", { messageId: "m1", roomId: "r1", content: "test" });
      expect(payload.dlpScan).toBeDefined();
      expect(payload.dlpScan.text).toBe("test");
    });

    it("builds Forcepoint payload", () => {
      const payload = buildScanPayload("forcepoint", { messageId: "m1", roomId: "r1", content: "test" });
      expect(payload.contentScan).toBeDefined();
    });

    it("builds custom webhook payload", () => {
      const payload = buildScanPayload("custom_webhook", { messageId: "m1", content: "test" });
      expect(payload.content).toBe("test");
    });
  });

  describe("parseScanResponse", () => {
    it("parses Microsoft Purview clean", () => {
      const result = parseScanResponse("microsoft_purview", { ScanResult: { Classification: "Clean" } });
      expect(result.verdict).toBe("clean");
    });

    it("parses Microsoft Purview violation", () => {
      const result = parseScanResponse("microsoft_purview", { ScanResult: { Classification: "Violation", Violations: ["PII"] } });
      expect(result.verdict).toBe("violation");
      expect(result.violations).toContain("PII");
    });

    it("parses Symantec clean", () => {
      const result = parseScanResponse("symantec", { matchFound: false });
      expect(result.verdict).toBe("clean");
    });

    it("parses Symantec violation", () => {
      const result = parseScanResponse("symantec", { matchFound: true, violations: ["SSN"] });
      expect(result.verdict).toBe("violation");
    });

    it("parses null response as error", () => {
      const result = parseScanResponse("custom_webhook", null);
      expect(result.verdict).toBe("error");
    });
  });

  describe("getDlpIntegrationStats", () => {
    it("returns stats", async () => {
      const env = makeEnv();
      await createIntegration(env, { projectId: "p1", name: "A", provider: "microsoft_purview", endpointUrl: "https://a.com" });
      await createIntegration(env, { projectId: "p1", name: "B", provider: "symantec", endpointUrl: "https://b.com" });
      const stats = await getDlpIntegrationStats(env, { projectId: "p1" });
      expect(stats.totalIntegrations).toBe(2);
      expect(stats.byProvider.microsoft_purview).toBeDefined();
    });
  });
});
