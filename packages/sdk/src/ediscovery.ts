export type HoldStatus = "active" | "released" | "expired";

export interface LegalHold {
  holdId: string;
  targetType: "user" | "room" | "message";
  targetId: string;
  reason: string;
  requestedBy: string;
  approvedBy: string;
  status: HoldStatus;
  createdAt: string;
  expiresAt: string;
  releasedAt?: string;
}

export interface ExportRequest {
  exportId: string;
  scope: { rooms: string[]; dateFrom: string; dateTo: string; includeAttachments: boolean };
  format: "json" | "pdf" | "csv" | "eml";
  status: "pending" | "processing" | "completed" | "failed";
  requestedBy: string;
  requestedAt: string;
  completedAt?: string;
  downloadUrl?: string;
}

export interface AuditEntry {
  auditId: string;
  action: "hold_created" | "hold_released" | "export_requested" | "export_completed" | "hold_expired";
  performedBy: string;
  targetId: string;
  details: string;
  timestamp: string;
  checksum: string;
}

export interface EdiscoveryConfig {
  maxHoldDays: number;
  maxExportSizeMb: number;
  requireDualApproval: boolean;
}

export interface EdiscoveryManager {
  createHold(hold: Omit<LegalHold, "holdId" | "status" | "createdAt">): LegalHold;
  releaseHold(holdId: string, releasedBy: string): LegalHold;
  getHold(holdId: string): LegalHold | null;
  listHolds(targetId?: string): LegalHold[];
  requestExport(request: Omit<ExportRequest, "exportId" | "status" | "requestedAt">): ExportRequest;
  completeExport(exportId: string, downloadUrl: string): ExportRequest;
  getExport(exportId: string): ExportRequest | null;
  getAuditLog(targetId?: string): AuditEntry[];
}

function sha256(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export function createEdiscoveryManager(config: Partial<EdiscoveryConfig> = {}): EdiscoveryManager {
  const holds = new Map<string, LegalHold>();
  const exports = new Map<string, ExportRequest>();
  const auditLog: AuditEntry[] = [];
  const cfg: EdiscoveryConfig = { maxHoldDays: 90, maxExportSizeMb: 500, requireDualApproval: true, ...config };

  function addAudit(action: AuditEntry["action"], performedBy: string, targetId: string, details: string): void {
    const ts = new Date().toISOString();
    auditLog.push({
      auditId: `audit-${auditLog.length + 1}-${Date.now()}`,
      action,
      performedBy,
      targetId,
      details,
      timestamp: ts,
      checksum: sha256(`${action}:${performedBy}:${targetId}:${ts}`),
    });
  }

  return {
    createHold(hold: Omit<LegalHold, "holdId" | "status" | "createdAt">): LegalHold {
      const id = `hold-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const entry: LegalHold = { ...hold, holdId: id, status: "active", createdAt: new Date().toISOString() };
      holds.set(id, entry);
      addAudit("hold_created", hold.requestedBy, hold.targetId, `Hold created: ${hold.reason}`);
      return entry;
    },

    releaseHold(holdId: string, releasedBy: string): LegalHold {
      const hold = holds.get(holdId);
      if (!hold) throw new Error(`Hold ${holdId} not found.`);
      hold.status = "released";
      hold.releasedAt = new Date().toISOString();
      addAudit("hold_released", releasedBy, hold.targetId, `Hold released by ${releasedBy}`);
      return hold;
    },

    getHold(holdId: string) { return holds.get(holdId) ?? null; },

    listHolds(targetId?: string) {
      const all = [...holds.values()];
      return targetId ? all.filter((h) => h.targetId === targetId) : all;
    },

    requestExport(request: Omit<ExportRequest, "exportId" | "status" | "requestedAt">): ExportRequest {
      const id = `export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const entry: ExportRequest = { ...request, exportId: id, status: "pending", requestedAt: new Date().toISOString() };
      exports.set(id, entry);
      addAudit("export_requested", request.requestedBy, id, `Export requested: ${request.scope.rooms.length} rooms`);
      return entry;
    },

    completeExport(exportId: string, downloadUrl: string): ExportRequest {
      const entry = exports.get(exportId);
      if (!entry) throw new Error(`Export ${exportId} not found.`);
      entry.status = "completed";
      entry.completedAt = new Date().toISOString();
      entry.downloadUrl = downloadUrl;
      addAudit("export_completed", "system", exportId, `Export completed: ${downloadUrl}`);
      return entry;
    },

    getExport(exportId: string) { return exports.get(exportId) ?? null; },

    getAuditLog(targetId?: string) {
      return targetId ? auditLog.filter((e) => e.targetId === targetId) : [...auditLog];
    },
  };
}
