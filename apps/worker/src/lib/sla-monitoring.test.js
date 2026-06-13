import { describe, it, expect } from 'vitest';
import {
  createSloDefinition,
  listSloDefinitions,
  recordSliDataPoint,
  getSliDataPoints,
  calculateSlaStatus,
  checkErrorBudgetAlerts,
  getStatusPageData,
} from './sla-monitoring.js';

// ─── Helper: mock DB ───
function createMockDb() {
  const store = { slo_definitions: [], sli_data_points: [] };

  function filterRows(table, sql, args) {
    let rows = [...store[table]];
    const parts = sql.split(/\bWHERE\b/i);
    if (parts.length > 1) {
      const whereStr = parts[1].split(/\bORDER\b|\bLIMIT\b|\bGROUP\b/i)[0];
      const clausePattern = /(\w+)\s*(=|>=|<=|>|<)\s*\?/g;
      let cm;
      const clauses = [];
      while ((cm = clausePattern.exec(whereStr)) !== null) {
        clauses.push({ col: cm[1], op: cm[2] });
      }
      let argIdx = 0;
      for (const clause of clauses) {
        const val = args[argIdx++];
        if (clause.op === '=') rows = rows.filter(r => r[clause.col] === val);
        else if (clause.op === '>=') rows = rows.filter(r => r[clause.col] >= val);
        else if (clause.op === '<=') rows = rows.filter(r => r[clause.col] <= val);
      }
    }
    return rows;
  }

  return {
    store,
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          const table = sql.includes('slo_definitions') ? 'slo_definitions' : 'sli_data_points';
          return filterRows(table, sql, args)[0] || null;
        },
        all: async () => {
          const table = sql.includes('slo_definitions') ? 'slo_definitions' : 'sli_data_points';
          return { results: filterRows(table, sql, args) };
        },
        run: async () => {
          if (sql.includes('INSERT INTO slo_definitions')) {
            const obj = {};
            const cols = sql.match(/\(([^)]+)\)/)?.[1]?.split(',').map(c => c.trim()) || [];
            const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/i);
            const values = valuesMatch ? valuesMatch[1].split(',').map(v => v.trim()) : [];
            let argIdx = 0;
            cols.forEach((c, i) => {
              if (values[i] === '?') obj[c] = args[argIdx++];
              else { const v = values[i]; obj[c] = v === 'NULL' ? null : (!isNaN(v) && v !== '') ? Number(v) : v; }
            });
            store.slo_definitions.push(obj);
          }
          if (sql.includes('INSERT INTO sli_data_points')) {
            const obj = {};
            const cols = sql.match(/\(([^)]+)\)/)?.[1]?.split(',').map(c => c.trim()) || [];
            const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/i);
            const values = valuesMatch ? valuesMatch[1].split(',').map(v => v.trim()) : [];
            let argIdx = 0;
            cols.forEach((c, i) => {
              if (values[i] === '?') obj[c] = args[argIdx++];
              else { const v = values[i]; obj[c] = v === 'NULL' ? null : (!isNaN(v) && v !== '') ? Number(v) : v; }
            });
            store.sli_data_points.push(obj);
          }
          return { meta: { changes: 1 } };
        },
      }),
    }),
  };
}

const env = (db) => ({ DB: db });

describe('P18-H: SLA Monitoring', () => {
  it('should create an SLO definition', async () => {
    const db = createMockDb();
    const slo = await createSloDefinition(env(db), {
      projectId: 'proj-1', name: 'API Availability', target: 99.9, windowDays: 30, metricType: 'availability',
    });
    expect(slo.id).toBeDefined();
    expect(slo.target).toBe(99.9);
    expect(slo.enabled).toBe(true);
  });

  it('should list SLO definitions', async () => {
    const db = createMockDb();
    await createSloDefinition(env(db), { projectId: 'proj-1', name: 'SLO 1' });
    await createSloDefinition(env(db), { projectId: 'proj-1', name: 'SLO 2' });
    const list = await listSloDefinitions(env(db), { projectId: 'proj-1' });
    expect(list.length).toBe(2);
  });

  it('should record SLI data points', async () => {
    const db = createMockDb();
    const dp = await recordSliDataPoint(env(db), {
      projectId: 'proj-1', sloId: 'slo-1', value: 1, metadata: { latencyMs: 45 },
    });
    expect(dp.id).toBeDefined();
    expect(dp.value).toBe(1);
  });

  it('should query SLI data points', async () => {
    const db = createMockDb();
    await recordSliDataPoint(env(db), { projectId: 'proj-1', sloId: 'slo-1', value: 1, timestamp: '2026-06-01T10:00:00Z' });
    await recordSliDataPoint(env(db), { projectId: 'proj-1', sloId: 'slo-1', value: 0, timestamp: '2026-06-01T11:00:00Z' });
    const points = await getSliDataPoints(env(db), { projectId: 'proj-1', sloId: 'slo-1' });
    expect(points.length).toBe(2);
  });

  it('should calculate SLA status', async () => {
    const db = createMockDb();
    const slo = await createSloDefinition(env(db), { projectId: 'proj-1', name: 'API', target: 99.9 });
    for (let i = 0; i < 99; i++) {
      await recordSliDataPoint(env(db), { projectId: 'proj-1', sloId: slo.id, value: 1, metadata: { latencyMs: 50 } });
    }
    await recordSliDataPoint(env(db), { projectId: 'proj-1', sloId: slo.id, value: 0, metadata: { latencyMs: 5000 } });
    const status = await calculateSlaStatus(env(db), { projectId: 'proj-1', sloId: slo.id });
    expect(status.actualUptime).toBe(99);
    expect(status.status).toBe('breaching');
    expect(status.breachDetected).toBe(true);
    expect(status.latencyPercentiles.p50).toBe(50);
  });

  it('should detect healthy status', async () => {
    const db = createMockDb();
    const slo = await createSloDefinition(env(db), { projectId: 'proj-1', name: 'API', target: 99.0 });
    for (let i = 0; i < 100; i++) {
      await recordSliDataPoint(env(db), { projectId: 'proj-1', sloId: slo.id, value: 1 });
    }
    const status = await calculateSlaStatus(env(db), { projectId: 'proj-1', sloId: slo.id });
    expect(status.status).toBe('healthy');
    expect(status.breachDetected).toBe(false);
  });

  it('should check error budget alerts', async () => {
    const db = createMockDb();
    const slo = await createSloDefinition(env(db), { projectId: 'proj-1', name: 'API', target: 99.9 });
    // 1 failure out of 100 = 99% uptime < 99.9% target
    for (let i = 0; i < 99; i++) await recordSliDataPoint(env(db), { projectId: 'proj-1', sloId: slo.id, value: 1 });
    await recordSliDataPoint(env(db), { projectId: 'proj-1', sloId: slo.id, value: 0 });
    const alerts = await checkErrorBudgetAlerts(env(db), { projectId: 'proj-1' });
    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe('breach');
  });

  it('should return status page data', async () => {
    const db = createMockDb();
    await createSloDefinition(env(db), { projectId: 'proj-1', name: 'API', target: 99.9 });
    const page = await getStatusPageData(env(db), { projectId: 'proj-1' });
    expect(page.projectId).toBe('proj-1');
    expect(page.overallStatus).toBe('operational');
    expect(page.services.length).toBe(1);
  });
});
