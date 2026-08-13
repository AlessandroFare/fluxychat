/**
 * CP-080: SOC 2 Type II readiness checklist — maps TSC criteria to FluxyChat controls.
 */

export const SOC2_TRUST_SERVICE_CATEGORIES = [
  "security",
  "availability",
  "processing_integrity",
  "confidentiality",
  "privacy",
];

/**
 * Built-in checklist items auditors expect for self-assessment.
 * Each item maps to a FluxyChat module or dashboard surface.
 */
export const SOC2_READINESS_CHECKLIST = [
  {
    id: "CC1.1",
    category: "security",
    criterion: "Control environment — security policies documented",
    fluxyModule: "soc2_policies + /soc2 dashboard",
    evidenceHint: "Export policies via GET /api/soc2/policies",
    selfAssessmentKey: "policies_documented",
  },
  {
    id: "CC6.1",
    category: "security",
    criterion: "Logical access — authentication on all API paths",
    fluxyModule: "JWT verifyJwtAndGetContext on every route",
    evidenceHint: "Auth middleware + failed auth logs",
    selfAssessmentKey: "auth_enforced",
  },
  {
    id: "CC6.2",
    category: "security",
    criterion: "Role-based access (owner/admin/agent/member)",
    fluxyModule: "hasAnyRole + project-scoped JWT",
    evidenceHint: "Role matrix in security docs",
    selfAssessmentKey: "rbac_enabled",
  },
  {
    id: "CC6.3",
    category: "security",
    criterion: "SSO / SCIM for enterprise tenants",
    fluxyModule: "/settings/identity SAML + SCIM",
    evidenceHint: "Identity settings + SAML metadata export",
    selfAssessmentKey: "sso_available",
  },
  {
    id: "CC6.6",
    category: "security",
    criterion: "Encryption in transit (TLS)",
    fluxyModule: "Cloudflare Workers edge TLS",
    evidenceHint: "Cloudflare TLS config + custom domain HTTPS",
    selfAssessmentKey: "tls_enforced",
  },
  {
    id: "CC6.7",
    category: "security",
    criterion: "Data loss prevention on message content",
    fluxyModule: "enterprise/dlp/scan + moderation-labels",
    evidenceHint: "SOC 2 page DLP smoke test",
    selfAssessmentKey: "dlp_enabled",
  },
  {
    id: "CC7.2",
    category: "security",
    criterion: "Security monitoring and audit logging",
    fluxyModule: "operational_audit_events + /admin/audit-export",
    evidenceHint: "Export audit log from /soc2",
    selfAssessmentKey: "audit_logging",
  },
  {
    id: "CC7.3",
    category: "security",
    criterion: "Incident response process",
    fluxyModule: "soc2_incidents + incident-response.js",
    evidenceHint: "POST /api/soc2/incidents",
    selfAssessmentKey: "incident_process",
  },
  {
    id: "CC8.1",
    category: "security",
    criterion: "Change management — CI + migration tracking",
    fluxyModule: "GitHub CI + db migrations numbered",
    evidenceHint: "CI workflow + migration files",
    selfAssessmentKey: "change_management",
  },
  {
    id: "A1.2",
    category: "availability",
    criterion: "Uptime monitoring and status page",
    fluxyModule: "/settings/status Upptime + /status",
    evidenceHint: "Public status page URL",
    selfAssessmentKey: "status_page",
  },
  {
    id: "A1.3",
    category: "availability",
    criterion: "Backup and disaster recovery",
    fluxyModule: "D1 + R2 exports + retention policies",
    evidenceHint: "Retention settings + audit chain R2 export",
    selfAssessmentKey: "backup_dr",
  },
  {
    id: "PI1.1",
    category: "processing_integrity",
    criterion: "Message delivery and idempotency",
    fluxyModule: "Room DO + client_message_id dedup",
    evidenceHint: "Message delivery tests",
    selfAssessmentKey: "message_integrity",
  },
  {
    id: "C1.1",
    category: "confidentiality",
    criterion: "E2E / MLS encryption options",
    fluxyModule: "/settings/e2e room MLS groups",
    evidenceHint: "E2E settings page",
    selfAssessmentKey: "encryption_options",
  },
  {
    id: "C1.2",
    category: "confidentiality",
    criterion: "Data residency region pinning",
    fluxyModule: "/settings/residency",
    evidenceHint: "Data residency client + worker enforcement",
    selfAssessmentKey: "data_residency",
  },
  {
    id: "P1.1",
    category: "privacy",
    criterion: "GDPR export and deletion",
    fluxyModule: "GET /gdpr/export + deletion flows",
    evidenceHint: "GDPR API routes",
    selfAssessmentKey: "gdpr_rights",
  },
  {
    id: "P2.1",
    category: "privacy",
    criterion: "EU consent and DPA tracking",
    fluxyModule: "/settings/consent eu_consent_dpa",
    evidenceHint: "Consent banner + DPA audit log",
    selfAssessmentKey: "consent_dpa",
  },
  {
    id: "P3.1",
    category: "privacy",
    criterion: "Retention and legal hold",
    fluxyModule: "/settings/retention legal hold",
    evidenceHint: "Retention policies + chain-of-custody",
    selfAssessmentKey: "retention_legal_hold",
  },
  {
    id: "AI-1",
    category: "security",
    criterion: "AI agent tool policy and HITL approvals",
    fluxyModule: "/settings/agent-tools + hitl-approval",
    evidenceHint: "Tool policy audit + approval requests",
    selfAssessmentKey: "ai_tool_policy",
  },
  {
    id: "AI-2",
    category: "security",
    criterion: "EU AI Act compliance module",
    fluxyModule: "eu-ai-act-compliance.js",
    evidenceHint: "EU AI Act settings + audit log",
    selfAssessmentKey: "eu_ai_act",
  },
];

/**
 * @param {*} env
 * @param {string} projectId
 */
export async function buildSoc2SelfAssessment(env, projectId) {
  const dashboard = await import("./soc2-compliance.js").then((m) =>
    m.getComplianceDashboard(env, { projectId }),
  );
  const controls = await import("./soc2-compliance.js").then((m) =>
    m.listControls(env, { projectId }),
  );
  const evidence = await import("./soc2-compliance.js").then((m) =>
    m.listEvidence(env, { projectId }),
  );
  const policies = await import("./soc2-compliance.js").then((m) =>
    m.listPolicies(env, { projectId }),
  );
  const incidents = await import("./soc2-compliance.js").then((m) =>
    m.listIncidents(env, { projectId, status: "open" }),
  );

  const controlCount = controls.length;
  const evidenceCount = evidence.length;
  const activePolicyCount = policies.filter((p) => p.status === "active").length;
  const openIncidentCount = incidents.length;

  const checklist = SOC2_READINESS_CHECKLIST.map((item) => {
    let automatedStatus = "manual_review";
    if (item.selfAssessmentKey === "policies_documented" && activePolicyCount > 0) {
      automatedStatus = "likely_met";
    }
    if (item.selfAssessmentKey === "audit_logging" && evidenceCount > 0) {
      automatedStatus = "likely_met";
    }
    if (item.selfAssessmentKey === "incident_process" && controlCount > 0) {
      automatedStatus = "partial";
    }
    if (item.selfAssessmentKey === "dlp_enabled") {
      automatedStatus = "product_capability";
    }
    if (item.selfAssessmentKey === "auth_enforced" || item.selfAssessmentKey === "rbac_enabled") {
      automatedStatus = "product_capability";
    }
    if (item.selfAssessmentKey === "tls_enforced") {
      automatedStatus = "platform_default";
    }
    return { ...item, automatedStatus };
  });

  const metSignals = checklist.filter(
    (c) => c.automatedStatus === "likely_met" || c.automatedStatus === "product_capability" || c.automatedStatus === "platform_default",
  ).length;

  return {
    generatedAt: new Date().toISOString(),
    projectId,
    summary: {
      checklistItems: checklist.length,
      automatedMetSignals: metSignals,
      controlsTracked: controlCount,
      evidenceArtifacts: evidenceCount,
      activePolicies: activePolicyCount,
      openIncidents: openIncidentCount,
      readinessScore: Math.round((metSignals / checklist.length) * 100),
    },
    dashboard,
    checklist,
    controls: controls.slice(0, 50),
    evidence: evidence.slice(0, 50),
    policies: policies.slice(0, 20),
    disclaimer:
      "Self-assessment only — not a SOC 2 Type II attestation. Engage a licensed CPA firm for formal audit.",
  };
}
