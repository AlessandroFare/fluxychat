import { describe, it, expect } from 'vitest';
import { listLabels, createLabel, classifyRoom, classifyMessage, getRoomClassification } from './data-classification.js';
import { createRetentionPolicy, createLegalHold, isRoomOnHold, createExportSnapshot } from './retention-legal-hold.js';
import { scanContent, redactText, createDlpRule } from './dlp-redaction.js';
import { createPolicy, checkPolicy, logViolation, getViolationStats } from './ai-action-policy.js';

// ─── Helper: mock DB ───
function createMockDb() {
  const store = {};
  const tables = ['data_classification_labels', 'room_classifications', 'message_classifications',
    'retention_policies', 'legal_holds', 'export_snapshots', 'dlp_rules', 'dlp_scan_results',
    'ai_action_policies', 'ai_policy_violations', 'ai_action_executions'];
  for (const t of tables) store[t] = [];

  function findTable(sql) {
    for (const t of tables) {
      if (sql.includes(t)) return t;
    }
    return null;
  }

  return {
    store,
    batch: async (statements) => {
      for (const stmt of statements) {
        await stmt.run();
      }
    },
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          const table = findTable(sql);
          if (!table) return null;
          if (sql.includes('COUNT(*)')) {
            const filtered = store[table].filter(r => r.project_id === args[0]);
            return { cnt: filtered.length };
          }
          if (table === 'room_classifications') {
            // getRoomClassification binds (roomId, projectId)
            return store[table].find(r => r.room_id === args[0] && r.project_id === args[1]) || null;
          }
          if (table === 'message_classifications') {
            return store[table].find(r => r.message_id === args[0] && r.project_id === args[1]) || null;
          }
          if (table === 'legal_holds') {
            // getLegalHold binds (holdId, projectId)
            return store[table].find(r => r.id === args[0] && r.project_id === args[1]) || null;
          }
          if (table === 'dlp_rules') {
            return store[table].find(r => r.id === args[0] && r.project_id === args[1]) || null;
          }
          if (table === 'ai_action_policies') {
            return store[table].find(r => r.id === args[0] && r.project_id === args[1]) || null;
          }
          // Default: find by id + project_id
          return store[table].find(r => r.id === args[0] && r.project_id === args[1]) || null;
        },
        all: async () => {
          const table = findTable(sql);
          if (!table) return { results: [] };
          if (sql.includes('GROUP BY')) {
            const groups = {};
            for (const r of store[table].filter(row => row.project_id === args[0])) {
              const key = r.violation_type || 'unknown';
              groups[key] = (groups[key] || 0) + 1;
            }
            return { results: Object.entries(groups).map(([violation_type, cnt]) => ({ violation_type, cnt })) };
          }
          if (table === 'room_classifications') {
            return { results: store[table].filter(r => r.room_id === args[1] && r.project_id === args[0]) };
          }
          if (table === 'legal_holds') {
            return { results: store[table].filter(r => r.project_id === args[0] && r.room_id === args[1] && !r.released_at) };
          }
          return { results: store[table].filter(r => r.project_id === args[0]) };
        },
        run: async () => {
          const table = findTable(sql);
          if (table) {
            if (sql.includes(`INSERT INTO ${table}`)) {
              const cols = sql.match(/\(([^)]+)\)/)?.[1]?.split(',').map(c => c.trim()) || [];
              const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/i);
              const values = valuesMatch ? valuesMatch[1].split(',').map(v => v.trim()) : [];
              const obj = {};
              let argIdx = 0;
              cols.forEach((c, i) => {
                if (values[i] === '?') {
                  obj[c] = args[argIdx++];
                } else {
                  const v = values[i];
                  if (v === 'NULL') obj[c] = null;
                  else if (!isNaN(v) && v !== '') obj[c] = Number(v);
                  else obj[c] = v;
                }
              });
              store[table].push(obj);
            }
            if (sql.includes(`UPDATE ${table}`)) {
              for (const row of store[table]) {
                if (row.id === args[args.length - 2] && row.project_id === args[args.length - 1]) {
                  Object.keys(row).forEach(k => { if (sql.includes(k + ' =')) row[k] = args[0]; });
                }
              }
            }
            if (sql.includes(`DELETE FROM ${table}`)) {
              store[table] = store[table].filter(r => !(r.id === args[0]));
            }
          }
          return { meta: { changes: 1 } };
        },
      }),
    }),
  };
}

const env = (db) => ({ DB: db });

// ─── Data Classification Tests ───

describe('P18-B: Data Classification', () => {
  it('should create and list classification labels', async () => {
    const db = createMockDb();
    const label = await createLabel(env(db), { projectId: 'proj-1', name: 'Confidential', level: 2, color: '#ff0000', description: 'Internal use only' });
    expect(label.id).toBeDefined();
    expect(label.name).toBe('Confidential');
    const labels = await listLabels(env(db), { projectId: 'proj-1' });
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it('should classify a room', async () => {
    const db = createMockDb();
    const label = await createLabel(env(db), { projectId: 'proj-1', name: 'Restricted', level: 3 });
    const result = await classifyRoom(env(db), { projectId: 'proj-1', roomId: 'room-1', labelId: label.id, classifiedBy: 'admin' });
    expect(result.roomId).toBe('room-1');
    expect(result.labelId).toBe(label.id);
  });

  it('should get room classification', async () => {
    const db = createMockDb();
    const label = await createLabel(env(db), { projectId: 'proj-1', name: 'Internal', level: 1 });
    await classifyRoom(env(db), { projectId: 'proj-1', roomId: 'room-1', labelId: label.id, classifiedBy: 'admin' });
    const classification = await getRoomClassification(env(db), { projectId: 'proj-1', roomId: 'room-1' });
    expect(classification).not.toBeNull();
    expect(classification.labelId).toBe(label.id);
  });

  it('should classify a message', async () => {
    const db = createMockDb();
    const label = await createLabel(env(db), { projectId: 'proj-1', name: 'PII', level: 2 });
    const result = await classifyMessage(env(db), { projectId: 'proj-1', messageId: 'msg-1', labelId: label.id, classifiedBy: 'admin' });
    expect(result.messageId).toBe('msg-1');
    expect(result.labelId).toBe(label.id);
  });
});

// ─── Retention + Legal Hold Tests ───

describe('P18-C: Retention + Legal Hold', () => {
  it('should create a retention policy', async () => {
    const db = createMockDb();
    const policy = await createRetentionPolicy(env(db), { projectId: 'proj-1', name: '90-day', retentionDays: 90, autoDelete: true });
    expect(policy.id).toBeDefined();
    expect(policy.retentionDays).toBe(90);
  });

  it('should create a legal hold', async () => {
    const db = createMockDb();
    const hold = await createLegalHold(env(db), { projectId: 'proj-1', roomId: 'room-1', reason: 'Litigation', placedBy: 'admin' });
    expect(hold.id).toBeDefined();
    expect(hold.reason).toBe('Litigation');
  });

  it('should check if room is on hold', async () => {
    const db = createMockDb();
    await createLegalHold(env(db), { projectId: 'proj-1', roomId: 'room-1', reason: 'Audit', placedBy: 'admin' });
    const onHold = await isRoomOnHold(env(db), { projectId: 'proj-1', roomId: 'room-1' });
    expect(onHold).toBe(true);
  });

  it('should create an export snapshot', async () => {
    const db = createMockDb();
    const snapshot = await createExportSnapshot(env(db), { projectId: 'proj-1', roomId: 'room-1', format: 'json', requestedBy: 'admin' });
    expect(snapshot.id).toBeDefined();
    expect(snapshot.status).toBe('pending');
  });
});

// ─── DLP + Redaction Tests ───

describe('P18-D: DLP + Redaction', () => {
  it('should detect SSN pattern', async () => {
    const db = createMockDb();
    const matches = await scanContent(env(db), { projectId: 'proj-1', text: 'My SSN is 123-45-6789' });
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.some(m => m.ruleType === 'ssn')).toBe(true);
  });

  it('should detect credit card pattern', async () => {
    const db = createMockDb();
    const matches = await scanContent(env(db), { projectId: 'proj-1', text: 'Card number: 4111111111111111' });
    expect(matches.some(m => m.ruleType === 'credit_card')).toBe(true);
  });

  it('should detect email pattern', async () => {
    const db = createMockDb();
    const matches = await scanContent(env(db), { projectId: 'proj-1', text: 'Contact: user@example.com' });
    expect(matches.some(m => m.ruleType === 'email')).toBe(true);
  });

  it('should detect API key pattern', async () => {
    const db = createMockDb();
    const matches = await scanContent(env(db), { projectId: 'proj-1', text: 'Key: sk-1234567890abcdef1234567890abcdef' });
    expect(matches.some(m => m.ruleType === 'api_key')).toBe(true);
  });

  it('should redact matched text', async () => {
    const db = createMockDb();
    const matches = await scanContent(env(db), { projectId: 'proj-1', text: 'SSN: 123-45-6789 and email: test@example.com' });
    const redacted = redactText('SSN: 123-45-6789 and email: test@example.com', matches);
    expect(redacted).not.toContain('123-45-6789');
    expect(redacted).not.toContain('test@example.com');
    expect(redacted).toContain('[REDACTED');
  });

  it('should create and list DLP rules', async () => {
    const db = createMockDb();
    const rule = await createDlpRule(env(db), { projectId: 'proj-1', name: 'Custom Secret', pattern: 'SECRET-\\d+', action: 'flag' });
    expect(rule.id).toBeDefined();
    expect(rule.name).toBe('Custom Secret');
  });
});

// ─── AI Action Policy Tests ───

describe('P18-E: AI Action Policy', () => {
  it('should create a policy', async () => {
    const db = createMockDb();
    const policy = await createPolicy(env(db), { projectId: 'proj-1', name: 'Block webhooks', actionType: 'webhook', allowed: false });
    expect(policy.id).toBeDefined();
    expect(policy.allowed).toBe(false);
  });

  it('should check policy - allowed action', async () => {
    const db = createMockDb();
    await createPolicy(env(db), { projectId: 'proj-1', name: 'Allow email', actionType: 'email', allowed: true, requireApproval: false });
    const result = await checkPolicy(env(db), { projectId: 'proj-1', actionType: 'email', toolName: 'send_email', userRoles: ['admin'] });
    expect(result.allowed).toBe(true);
  });

  it('should check policy - blocked action', async () => {
    const db = createMockDb();
    await createPolicy(env(db), { projectId: 'proj-1', name: 'Block webhooks', actionType: 'webhook', allowed: false });
    const result = await checkPolicy(env(db), { projectId: 'proj-1', actionType: 'webhook', toolName: 'call_webhook', userRoles: ['admin'] });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('denied');
  });

  it('should check policy - requires approval', async () => {
    const db = createMockDb();
    await createPolicy(env(db), { projectId: 'proj-1', name: 'High-risk email', actionType: 'email', allowed: true, requireApproval: true });
    const result = await checkPolicy(env(db), { projectId: 'proj-1', actionType: 'email', toolName: 'send_email', userRoles: ['admin'] });
    expect(result.allowed).toBe(true);
    expect(result.requireApproval).toBe(true);
  });

  it('should log a violation', async () => {
    const db = createMockDb();
    const policy = await createPolicy(env(db), { projectId: 'proj-1', name: 'Test', actionType: 'test' });
    await logViolation(env(db), { projectId: 'proj-1', policyId: policy.id, violationType: 'rate_limit', details: { tool: 'test' } });
    expect(db.store.ai_policy_violations.length).toBe(1);
  });

  it('should get violation stats', async () => {
    const db = createMockDb();
    const stats = await getViolationStats(env(db), { projectId: 'proj-1' });
    expect(stats).toBeDefined();
    expect(stats.total).toBe(0);
    expect(stats.byType).toEqual({});
  });
});
