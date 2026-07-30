import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export interface HipaaBaa {
  id: string;
  projectId: string;
  entityName: string;
  entityType: string;
  contactName: string | null;
  contactEmail: string | null;
  status: string;
  effectiveDate: string | null;
  expirationDate: string | null;
  signedAt: string | null;
  signedBy: string | null;
  documentUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HipaaDashboard {
  baaStatus: Array<{ status: string; count: number }>;
  phiAccess: Array<{ action: string; count: number }>;
  phiDetections: Array<{ type: string; action: string; count: number }>;
  breaches: Array<{ status: string; severity: string; count: number }>;
  training: Array<{ status: string; count: number }>;
}

export async function getHipaaDashboard(token: string): Promise<HipaaDashboard> {
  return fetchWorkerJson(`${BASE}/api/hipaa/dashboard`, { headers: authHeaders(token) });
}

export async function listHipaaBaas(token: string, status?: string): Promise<HipaaBaa[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return fetchWorkerJson(`${BASE}/api/hipaa/baa${q}`, { headers: authHeaders(token) });
}

export async function createHipaaBaa(
  token: string,
  body: {
    entityName: string;
    entityType: string;
    contactName?: string;
    contactEmail?: string;
    effectiveDate?: string;
    expirationDate?: string;
    documentUrl?: string;
  },
): Promise<{ id: string }> {
  return fetchWorkerJson(`${BASE}/api/hipaa/baa`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function updateHipaaBaa(
  token: string,
  baaId: string,
  body: { status?: string; signedBy?: string },
): Promise<{ updated: boolean }> {
  return fetchWorkerJson(`${BASE}/api/hipaa/baa/${baaId}`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const HIPAA_READINESS_CHECKLIST = [
  { id: "baa", label: "Executed BAA with covered entity or business associate" },
  { id: "dlp", label: "DLP PHI patterns enabled (Settings → DLP or SOC 2 smoke test)" },
  { id: "access", label: "PHI access logging wired for admin and agent tools" },
  { id: "minimum", label: "Minimum-necessary policy documented for support staff" },
  { id: "breach", label: "Breach notification runbook assigned to on-call" },
  { id: "training", label: "Workforce HIPAA training assigned and tracked" },
  { id: "encryption", label: "Encryption at rest / in transit documented (CMK optional)" },
  { id: "retention", label: "Retention and legal hold aligned with BA obligations" },
] as const;

export const BAA_TEMPLATE_MARKDOWN = `# Business Associate Agreement (template — not legal advice)

**Between:** [Covered Entity Name] ("Covered Entity")  
**And:** [Your Organization] ("Business Associate")

## 1. Purpose
Business Associate may create, receive, maintain, or transmit Protected Health Information (PHI) on behalf of Covered Entity when using FluxyChat for [describe use case].

## 2. Permitted uses
Business Associate will use PHI only to provide the Services, as required by law, or as authorized in writing by Covered Entity.

## 3. Safeguards
Business Associate implements administrative, physical, and technical safeguards including access control, audit logging, encryption in transit (TLS), and DLP detection for common PHI patterns.

## 4. Reporting
Business Associate will report any Security Incident or Breach involving PHI without unreasonable delay and no later than [72] hours after discovery.

## 5. Subcontractors
Business Associate ensures subprocessors with PHI access agree to equivalent restrictions (Cloudflare, model providers as configured).

## 6. Termination
Upon termination, Business Associate will return or destroy PHI where feasible, subject to legal retention requirements.

---

**Covered Entity:** _________________________ Date: _________  
**Business Associate:** ______________________ Date: _________

Replace placeholders with counsel-approved language before execution.
`;
