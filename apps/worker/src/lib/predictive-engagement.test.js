import { describe, it, expect } from 'vitest';
import {
  recordUserActivity,
  getUserActivityLog,
  predictChurnRisk,
  calculateOptimalSendTime,
  forecastActivity,
  analyzeProjectChurn,
} from './predictive-engagement.js';

// ─── Helper: mock DB ───
function createMockDb() {
  const store = { user_activity_log: [] };

  function filterRows(table, sql, args) {
    let rows = [...store[table]];
    const parts = sql.split(/\bWHERE\b/i);
    if (parts.length > 1) {
      const whereStr = parts[1].split(/\bORDER\b|\bLIMIT\b|\bGROUP\b|\bDISTINCT\b/i)[0];
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
        first: async () => filterRows('user_activity_log', sql, args)[0] || null,
        all: async () => {
          let rows = filterRows('user_activity_log', sql, args);
          if (sql.includes('DISTINCT')) {
            const seen = new Set();
            rows = rows.filter(r => { if (seen.has(r.user_id)) return false; seen.add(r.user_id); return true; });
          }
          return { results: rows };
        },
        run: async () => {
          if (sql.includes('INSERT INTO user_activity_log')) {
            const obj = {};
            const cols = sql.match(/\(([^)]+)\)/)?.[1]?.split(',').map(c => c.trim()) || [];
            const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/i);
            const values = valuesMatch ? valuesMatch[1].split(',').map(v => v.trim()) : [];
            let argIdx = 0;
            cols.forEach((c, i) => {
              if (values[i] === '?') obj[c] = args[argIdx++];
              else { const v = values[i]; obj[c] = v === 'NULL' ? null : (!isNaN(v) && v !== '') ? Number(v) : v; }
            });
            store.user_activity_log.push(obj);
          }
          return { meta: { changes: 1 } };
        },
      }),
    }),
  };
}

const env = (db) => ({ DB: db });

describe('P18-I: Predictive Engagement', () => {
  it('should record user activity', async () => {
    const db = createMockDb();
    const act = await recordUserActivity(env(db), {
      projectId: 'proj-1', userId: 'u1', roomId: 'room-1', activityType: 'message',
    });
    expect(act.id).toBeDefined();
    expect(act.activityType).toBe('message');
  });

  it('should query user activity log', async () => {
    const db = createMockDb();
    await recordUserActivity(env(db), { projectId: 'proj-1', userId: 'u1', activityType: 'message', timestamp: '2026-06-01T10:00:00Z' });
    await recordUserActivity(env(db), { projectId: 'proj-1', userId: 'u1', activityType: 'reaction', timestamp: '2026-06-01T11:00:00Z' });
    const log = await getUserActivityLog(env(db), { projectId: 'proj-1', userId: 'u1' });
    expect(log.length).toBe(2);
  });

  it('should predict churn risk - no data', async () => {
    const db = createMockDb();
    const pred = await predictChurnRisk(env(db), { projectId: 'proj-1', userId: 'u1' });
    expect(pred.risk).toBe('unknown');
    expect(pred.score).toBe(0);
  });

  it('should predict churn risk - high risk', async () => {
    const db = createMockDb();
    // Activity 20 days ago, nothing since
    const old = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    await recordUserActivity(env(db), { projectId: 'proj-1', userId: 'u1', activityType: 'message', timestamp: old });
    const pred = await predictChurnRisk(env(db), { projectId: 'proj-1', userId: 'u1' });
    expect(pred.risk).toBe('high');
    expect(pred.score).toBeGreaterThan(70);
    expect(pred.factors).toContain('inactive_7d');
  });

  it('should predict churn risk - low risk', async () => {
    const db = createMockDb();
    // Recent activity across multiple days and rooms
    for (let i = 0; i < 30; i++) {
      const ts = new Date(Date.now() - i * 2 * 60 * 60 * 1000).toISOString();
      await recordUserActivity(env(db), {
        projectId: 'proj-1', userId: 'u1', roomId: `room-${i % 3}`,
        activityType: i % 2 === 0 ? 'message' : 'reaction', timestamp: ts,
      });
    }
    const pred = await predictChurnRisk(env(db), { projectId: 'proj-1', userId: 'u1' });
    expect(pred.risk).toBe('low');
    expect(pred.score).toBeLessThan(40);
  });

  it('should calculate optimal send time', async () => {
    const db = createMockDb();
    // Create activities at different hours
    for (let h = 0; h < 24; h++) {
      const count = h >= 9 && h <= 17 ? 10 : 1; // Business hours more active
      for (let i = 0; i < count; i++) {
        const ts = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
        ts.setUTCHours(h, 0, 0, 0);
        await recordUserActivity(env(db), { projectId: 'proj-1', userId: 'u1', activityType: 'message', timestamp: ts.toISOString() });
      }
    }
    const result = await calculateOptimalSendTime(env(db), { projectId: 'proj-1', userId: 'u1' });
    expect(result.optimalHours.length).toBe(3);
    expect(result.heatmap.length).toBe(24);
    expect(result.confidence).toMatch(/low|medium|high/);
  });

  it('should forecast activity', async () => {
    const db = createMockDb();
    for (let i = 0; i < 30; i++) {
      const ts = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      await recordUserActivity(env(db), { projectId: 'proj-1', userId: 'u1', activityType: 'message', timestamp: ts.toISOString() });
    }
    const forecast = await forecastActivity(env(db), { projectId: 'proj-1', userId: 'u1', forecastDays: 7 });
    expect(forecast.predictions.length).toBe(7);
    expect(forecast.predictions[0].date).toBeDefined();
  });

  it('should analyze project churn', async () => {
    const db = createMockDb();
    // Create activity for 3 users
    for (const uid of ['u1', 'u2', 'u3']) {
      for (let i = 0; i < 5; i++) {
        const ts = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString();
        await recordUserActivity(env(db), { projectId: 'proj-1', userId: uid, activityType: 'message', timestamp: ts });
      }
    }
    const analysis = await analyzeProjectChurn(env(db), { projectId: 'proj-1' });
    expect(analysis.totalUsers).toBe(3);
    expect(analysis.riskDistribution).toBeDefined();
  });
});
