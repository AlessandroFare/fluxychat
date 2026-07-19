export type DlpEntityType = "phi" | "pci" | "pii" | "credential" | "custom";
export type DlpAction = "block" | "redact" | "quarantine" | "flag" | "allow";
export type DlpContentKind = "text" | "file" | "audio";

export interface DlpPattern {
  patternId: string;
  entityType: DlpEntityType;
  label: string;
  regex: string;
  severity: "low" | "medium" | "high" | "critical";
  action: DlpAction;
}

export interface DlpPolicy {
  policyId: string;
  name: string;
  version: number;
  patterns: DlpPattern[];
  contentKinds: DlpContentKind[];
  enabled: boolean;
  createdAt: string;
}

export interface DlpMatch {
  patternId: string;
  entityType: DlpEntityType;
  label: string;
  startIndex: number;
  endIndex: number;
  matched: string;
  confidence: number;
  action: DlpAction;
}

export interface DlpResult {
  contentId: string;
  kind: DlpContentKind;
  safe: boolean;
  matches: DlpMatch[];
  action: DlpAction;
  redacted?: string;
  policyVersion: number;
}

export interface DlpDetector {
  createPolicy(policy: Omit<DlpPolicy, "createdAt">): DlpPolicy;
  updatePolicy(policyId: string, updates: Partial<DlpPolicy>): DlpPolicy;
  getPolicy(policyId: string): DlpPolicy | null;
  listPolicies(): DlpPolicy[];
  scanText(contentId: string, text: string, policyId?: string): DlpResult;
  scanFile(contentId: string, kind: DlpContentKind, policyId?: string): DlpResult;
}

const PHI_PATTERNS: DlpPattern[] = [
  { patternId: "ssn", entityType: "phi", label: "US SSN", regex: "\\d{3}-\\d{2}-\\d{4}", severity: "critical", action: "redact" },
  { patternId: "email", entityType: "pii", label: "Email", regex: "[\\w.-]+@[\\w.-]+\\.\\w{2,}", severity: "medium", action: "flag" },
  { patternId: "phone", entityType: "pii", label: "Phone", regex: "\\+?1?\\d{10,}", severity: "medium", action: "flag" },
];

const PCI_PATTERNS: DlpPattern[] = [
  { patternId: "cc", entityType: "pci", label: "Credit Card", regex: "\\d{4}[ -]?\\d{4}[ -]?\\d{4}[ -]?\\d{4}", severity: "critical", action: "block" },
  { patternId: "cvv", entityType: "pci", label: "CVV", regex: "\\b\\d{3,4}\\b", severity: "high", action: "block" },
];

export function createDlpDetector(): DlpDetector {
  let policies = new Map<string, DlpPolicy>();
  let versionCounter = 1;

  function buildDefaultPolicy(): DlpPolicy {
    return {
      policyId: "default",
      name: "Default DLP Policy",
      version: versionCounter++,
      patterns: [...PHI_PATTERNS, ...PCI_PATTERNS],
      contentKinds: ["text", "file", "audio"],
      enabled: true,
      createdAt: new Date().toISOString(),
    };
  }

  policies.set("default", buildDefaultPolicy());

  function scan(input: string, policy: DlpPolicy): DlpMatch[] {
    const matches: DlpMatch[] = [];
    for (const pattern of policy.patterns) {
      try {
        const re = new RegExp(pattern.regex, "g");
        let match: RegExpExecArray | null;
        while ((match = re.exec(input)) !== null) {
          matches.push({
            patternId: pattern.patternId,
            entityType: pattern.entityType,
            label: pattern.label,
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            matched: match[0],
            confidence: pattern.severity === "critical" ? 0.95 : pattern.severity === "high" ? 0.85 : 0.75,
            action: pattern.action,
          });
        }
      } catch {
        continue;
      }
    }
    return matches;
  }

  return {
    createPolicy(policy: Omit<DlpPolicy, "createdAt">): DlpPolicy {
      const full: DlpPolicy = { ...policy, createdAt: new Date().toISOString() };
      policies.set(policy.policyId, full);
      return full;
    },

    updatePolicy(policyId: string, updates: Partial<DlpPolicy>): DlpPolicy {
      const existing = policies.get(policyId);
      if (!existing) throw new Error(`Policy ${policyId} not found.`);
      const updated: DlpPolicy = { ...existing, ...updates, version: versionCounter++ };
      policies.set(policyId, updated);
      return updated;
    },

    getPolicy(policyId: string) { return policies.get(policyId) ?? null; },

    listPolicies() { return [...policies.values()]; },

    scanText(contentId: string, text: string, policyId?: string): DlpResult {
      const policy = policyId ? policies.get(policyId) : policies.get("default");
      if (!policy) throw new Error(`Policy ${policyId ?? "default"} not found.`);

      const matches = scan(text, policy);
      const severity = matches.reduce((max, m) => {
        const levels = { low: 0, medium: 1, high: 2, critical: 3 };
        const pattern = policy.patterns.find((p) => p.patternId === m.patternId);
        return Math.max(max, levels[pattern?.severity ?? "low"]);
      }, 0);

      const action: DlpAction = severity >= 3 ? "block" : severity >= 2 ? "quarantine" : "flag";
      let redacted: string | undefined;
      if (action === "redact" || action === "block") {
        redacted = text;
        for (const m of matches.sort((a, b) => b.startIndex - a.startIndex)) {
          redacted = redacted.slice(0, m.startIndex) + "[REDACTED]" + redacted.slice(m.endIndex);
        }
      }

      return {
        contentId,
        kind: "text",
        safe: matches.filter((m) => m.action !== "allow").length === 0,
        matches,
        action,
        redacted,
        policyVersion: policy.version,
      };
    },

    scanFile(contentId: string, kind: DlpContentKind, policyId?: string): DlpResult {
      return {
        contentId,
        kind,
        safe: true,
        matches: [],
        action: "allow",
        policyVersion: (policyId ? policies.get(policyId) : policies.get("default"))?.version ?? 0,
      };
    },
  };
}
