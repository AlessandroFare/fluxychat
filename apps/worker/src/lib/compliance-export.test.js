import { describe, it, expect } from 'vitest';
import {
  computeExportHash,
  toCsv,
  formatExport,
  createExportRequest,
  completeExport,
  getExportSnapshot,
  listExportRequests,
  queryMessages,
  queryReadReceipts,
  queryAuditEvents,
  queryModerationEvents,
  executeExport,
} from './compliance-export.js';

// ─── Helper: mock DB (SQL-aware) ───
function createMockDb(seedData = {}) {
  const store = {
    messages: seedData.messages || [],
    read_receipts: seedData.read_receipts || [],
    operational_audit_events: seedData.operational_audit_events || [],
    moderation_events: seedData.moderation_events || [],
    export_snapshots: [],
  };

  function filterRows(table, sql, args) {
    let rows = [...store[table]];
    // Parse WHERE clauses: "col = ?" patterns
    const whereClauses = [];
    const parts = sql.split(/\bWHERE\b/i);
    if (parts.length > 1) {
      const whereStr = parts[1].split(/\bORDER\b|\bLIMIT\b|\bGROUP\b/i)[0];
      const clausePattern = /(\w+)\s*(=|>=|<=|>|<)\s*\?/g;
      let cm;
      while ((cm = clausePattern.exec(whereStr)) !== null) {
        whereClauses.push({ col: cm[1], op: cm[2] });
      }
    }
    let argIdx = 0;
    for (const clause of whereClauses) {
      const val = args[argIdx++];
      if (clause.op === '=') rows = rows.filter(r => r[clause.col] === val);
      else if (clause.op === '>=') rows = rows.filter(r => r[clause.col] >= val);
      else if (clause.op === '<=') rows = rows.filter(r => r[clause.col] <= val);
    }
    return rows;
  }

  return {
    store,
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('export_snapshots') && sql.includes('WHERE id')) {
            return store.export_snapshots.find(r => r.id === args[0] && r.project_id === args[1]) || null;
          }
          const rows = filterRows(
            sql.includes('messages') ? 'messages' :
            sql.includes('read_receipts') ? 'read_receipts' :
            sql.includes('operational_audit_events') ? 'operational_audit_events' :
            sql.includes('moderation_events') ? 'moderation_events' :
            sql.includes('export_snapshots') ? 'export_snapshots' : null,
            sql, args
          );
          return rows[0] || null;
        },
        all: async () => {
          const table = sql.includes('FROM messages') ? 'messages' :
            sql.includes('read_receipts') ? 'read_receipts' :
            sql.includes('operational_audit_events') ? 'operational_audit_events' :
            sql.includes('moderation_events') ? 'moderation_events' :
            sql.includes('export_snapshots') ? 'export_snapshots' : null;
          if (!table) return { results: [] };
          const rows = filterRows(table, sql, args);
          return { results: rows };
        },
        run: async () => {
          if (sql.includes('INSERT INTO export_snapshots')) {
            const obj = {};
            const cols = sql.match(/\(([^)]+)\)/)?.[1]?.split(',').map(c => c.trim()) || [];
            const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/i);
            const values = valuesMatch ? valuesMatch[1].split(',').map(v => v.trim()) : [];
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
            store.export_snapshots.push(obj);
          }
          if (sql.includes('UPDATE export_snapshots')) {
            for (const row of store.export_snapshots) {
              if (row.id === args[3] && row.project_id === args[4]) {
                row.status = args[0];
                row.message_count = args[1];
                row.completed_at = args[2];
              }
            }
          }
          return { meta: { changes: 1 } };
        },
      }),
    }),
  };
}

const env = (db) => ({ DB: db });

// ─── SHA-256 Hash Tests ───

describe('P18-F: Compliance Export', () => {
  describe('computeExportHash', () => {
    it('should compute SHA-256 hash of a string', async () => {
      const hash = await computeExportHash('hello world');
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    it('should compute SHA-256 hash of an object', async () => {
      const hash = await computeExportHash({ foo: 'bar' });
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64);
    });

    it('should produce consistent hashes', async () => {
      const h1 = await computeExportHash({ a: 1 });
      const h2 = await computeExportHash({ a: 1 });
      expect(h1).toBe(h2);
    });

    it('should produce different hashes for different data', async () => {
      const h1 = await computeExportHash({ a: 1 });
      const h2 = await computeExportHash({ a: 2 });
      expect(h1).not.toBe(h2);
    });
  });

  describe('toCsv', () => {
    it('should convert array of objects to CSV', () => {
      const csv = toCsv([{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }]);
      const lines = csv.split('\n');
      expect(lines[0]).toBe('name,age');
      expect(lines[1]).toBe('Alice,30');
      expect(lines[2]).toBe('Bob,25');
    });

    it('should handle empty array', () => {
      expect(toCsv([])).toBe('');
    });

    it('should escape commas in values', () => {
      const csv = toCsv([{ msg: 'hello, world' }]);
      expect(csv).toContain('"hello, world"');
    });

    it('should use provided columns', () => {
      const csv = toCsv([{ a: 1, b: 2, c: 3 }], ['a', 'c']);
      expect(csv).toBe('a,c\n1,3');
    });
  });

  describe('formatExport', () => {
    it('should format as JSON', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const result = formatExport(data, 'json');
      expect(JSON.parse(result)).toEqual(data);
    });

    it('should format as CSV', () => {
      const data = [{ id: 1, name: 'test' }];
      const result = formatExport(data, 'csv');
      expect(result).toContain('id,name');
      expect(result).toContain('1,test');
    });
  });

  describe('Export Snapshots CRUD', () => {
    it('should create an export request', async () => {
      const db = createMockDb();
      const snapshot = await createExportRequest(env(db), {
        projectId: 'proj-1',
        roomId: 'room-1',
        format: 'json',
        filter: { startTime: '2026-01-01' },
        requestedBy: 'admin',
      });
      expect(snapshot.id).toBeDefined();
      expect(snapshot.status).toBe('pending');
      expect(snapshot.format).toBe('json');
    });

    it('should complete an export', async () => {
      const db = createMockDb();
      const snapshot = await createExportRequest(env(db), { projectId: 'proj-1', requestedBy: 'admin' });
      const result = await completeExport(env(db), {
        projectId: 'proj-1',
        snapshotId: snapshot.id,
        messageCount: 42,
        hash: 'abc123',
        status: 'completed',
      });
      expect(result.status).toBe('completed');
      expect(result.messageCount).toBe(42);
    });

    it('should get an export snapshot', async () => {
      const db = createMockDb();
      const snapshot = await createExportRequest(env(db), { projectId: 'proj-1', requestedBy: 'admin' });
      const found = await getExportSnapshot(env(db), { projectId: 'proj-1', snapshotId: snapshot.id });
      expect(found).not.toBeNull();
      expect(found.id).toBe(snapshot.id);
    });

    it('should list export requests', async () => {
      const db = createMockDb();
      await createExportRequest(env(db), { projectId: 'proj-1', requestedBy: 'admin' });
      await createExportRequest(env(db), { projectId: 'proj-1', requestedBy: 'admin' });
      const list = await listExportRequests(env(db), { projectId: 'proj-1' });
      expect(list.length).toBe(2);
    });
  });

  describe('Data Querying', () => {
    const seedData = {
      messages: [
        { id: 'm1', project_id: 'proj-1', room_id: 'room-1', user_id: 'u1', content: 'hello', created_at: '2026-06-01T10:00:00Z', parent_id: null, deleted_at: null, expires_at: null, visibility: null },
        { id: 'm2', project_id: 'proj-1', room_id: 'room-1', user_id: 'u2', content: 'world', created_at: '2026-06-01T11:00:00Z', parent_id: null, deleted_at: null, expires_at: null, visibility: null },
        { id: 'm3', project_id: 'proj-1', room_id: 'room-2', user_id: 'u1', content: 'other', created_at: '2026-06-02T10:00:00Z', parent_id: null, deleted_at: null, expires_at: null, visibility: null },
      ],
      read_receipts: [
        { project_id: 'proj-1', room_id: 'room-1', user_id: 'u1', message_id: 'm1', created_at: '2026-06-01T10:05:00Z' },
      ],
      operational_audit_events: [
        { project_id: 'proj-1', action: 'message.send', actor_user_id: 'u1', target_type: 'message', target_id: 'm1', created_at: '2026-06-01T10:00:00Z', metadata: '{}' },
      ],
      moderation_events: [
        { project_id: 'proj-1', room_id: 'room-1', user_id: 'u2', action: 'warn', reason: 'spam', created_at: '2026-06-01T11:30:00Z' },
      ],
    };

    it('should query messages by room', async () => {
      const db = createMockDb(seedData);
      const messages = await queryMessages(env(db), { projectId: 'proj-1', roomId: 'room-1' });
      expect(messages.length).toBe(2);
    });

    it('should query messages by user', async () => {
      const db = createMockDb(seedData);
      const messages = await queryMessages(env(db), { projectId: 'proj-1', userId: 'u2' });
      expect(messages.length).toBe(1);
      expect(messages[0].userId).toBe('u2');
    });

    it('should query messages by time range', async () => {
      const db = createMockDb(seedData);
      const messages = await queryMessages(env(db), {
        projectId: 'proj-1',
        startTime: '2026-06-01T10:30:00Z',
        endTime: '2026-06-02T00:00:00Z',
      });
      expect(messages.length).toBe(1);
      expect(messages[0].id).toBe('m2');
    });

    it('should query read receipts', async () => {
      const db = createMockDb(seedData);
      const receipts = await queryReadReceipts(env(db), { projectId: 'proj-1', roomId: 'room-1' });
      expect(receipts.length).toBe(1);
    });

    it('should query audit events', async () => {
      const db = createMockDb(seedData);
      const events = await queryAuditEvents(env(db), { projectId: 'proj-1' });
      expect(events.length).toBe(1);
      expect(events[0].action).toBe('message.send');
    });

    it('should query moderation events', async () => {
      const db = createMockDb(seedData);
      const events = await queryModerationEvents(env(db), { projectId: 'proj-1', roomId: 'room-1' });
      expect(events.length).toBe(1);
      expect(events[0].action).toBe('warn');
    });
  });

  describe('Full Export', () => {
    it('should execute a full export with JSON format', async () => {
      const db = createMockDb({
        messages: [
          { id: 'm1', project_id: 'proj-1', room_id: 'room-1', user_id: 'u1', content: 'hello', created_at: '2026-06-01T10:00:00Z', parent_id: null, deleted_at: null, expires_at: null, visibility: null },
        ],
      });
      const result = await executeExport(env(db), {
        projectId: 'proj-1',
        roomId: 'room-1',
        startTime: '2026-06-01T00:00:00Z',
        endTime: '2026-06-02T00:00:00Z',
        format: 'json',
        requestedBy: 'admin',
      });
      expect(result.snapshot.id).toBeDefined();
      expect(result.hash).toBeDefined();
      expect(result.hash.length).toBe(64);
      const parsed = JSON.parse(result.data);
      expect(parsed.messages.length).toBe(1);
      expect(parsed.integrityHash).toBe(result.hash);
    });

    it('should execute a full export with CSV format', async () => {
      const db = createMockDb({
        messages: [
          { id: 'm1', project_id: 'proj-1', room_id: 'room-1', user_id: 'u1', content: 'hello', created_at: '2026-06-01T10:00:00Z', parent_id: null, deleted_at: null, expires_at: null, visibility: null },
        ],
      });
      const result = await executeExport(env(db), {
        projectId: 'proj-1',
        roomId: 'room-1',
        startTime: '2026-06-01T00:00:00Z',
        endTime: '2026-06-02T00:00:00Z',
        format: 'csv',
        requestedBy: 'admin',
      });
      expect(result.snapshot.format).toBe('csv');
      expect(result.data).toContain('id,userId,content');
    });

    it('should produce tamper-evident hash', async () => {
      const db = createMockDb();
      const r1 = await executeExport(env(db), {
        projectId: 'proj-1',
        startTime: '2026-06-01T00:00:00Z',
        endTime: '2026-06-02T00:00:00Z',
        format: 'json',
        requestedBy: 'admin',
      });
      // Verify hash matches re-computation from original exportData object
      const { integrityHash, ...dataWithoutHash } = r1.exportData;
      const hash2 = await computeExportHash(dataWithoutHash);
      expect(hash2).toBe(r1.hash);
    });
  });
});
