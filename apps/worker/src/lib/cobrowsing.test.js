import { describe, it, expect } from 'vitest';
import { createSession, endSession, pauseSession, resumeSession, getSession, listActiveSessions, joinSession, leaveSession, updateCursor, addAnnotation, listAnnotations, grantRemoteControl, revokeRemoteControl, listViewers, getCobrowsingStats } from './cobrowsing.js';

function createEnv(rows = {}) {
  const seq = rows.sequence || null;
  let callIdx = 0;
  return {
    DB: {
      prepare(sql) {
        const isSelect = sql.startsWith('SELECT');
        return {
          bind() {
            return {
              first: async () => {
                if (seq && callIdx < seq.length) return seq[callIdx++];
                return isSelect ? rows.first || null : null;
              },
              all: async () => (isSelect ? { results: rows.all || [] } : { results: [] }),
              run: async () => ({ meta: { changes: rows.changes || 1 } }),
            };
          },
        };
      },
    },
  };
}

describe('cobrowsing lib', () => {
  describe('createSession', () => {
    it('creates a session', async () => {
      const env = createEnv();
      const session = await createSession(env, { projectId: 'p1', roomId: 'r1', createdBy: 'u1', url: 'https://example.com' });
      expect(session.id).toMatch(/^cb_/);
      expect(session.status).toBe('active');
    });
  });

  describe('endSession', () => {
    it('ends a session with duration', async () => {
      const env = createEnv({ first: { started_at: new Date(Date.now() - 60000).toISOString() } });
      const result = await endSession(env, { sessionId: 'cb-1' });
      expect(result.ended).toBe(1);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('pauseSession', () => {
    it('pauses a session', async () => {
      const env = createEnv();
      const result = await pauseSession(env, { sessionId: 'cb-1' });
      expect(result.paused).toBe(1);
    });
  });

  describe('resumeSession', () => {
    it('resumes a session', async () => {
      const env = createEnv();
      const result = await resumeSession(env, { sessionId: 'cb-1' });
      expect(result.resumed).toBe(1);
    });
  });

  describe('getSession', () => {
    it('returns null if not found', async () => {
      const env = createEnv({ first: null });
      const session = await getSession(env, { sessionId: 'nonexistent' });
      expect(session).toBeNull();
    });
  });

  describe('listActiveSessions', () => {
    it('returns active sessions', async () => {
      const env = createEnv({ all: [{ id: 'cb-1', project_id: 'p1', room_id: 'r1', created_by: 'u1', url: null, status: 'active', max_viewers: 25, annotations_enabled: 1, remote_control_enabled: 0, started_at: '2026-01-01T00:00:00Z', ended_at: null, duration_ms: null, created_at: '2026-01-01T00:00:00Z' }] });
      const sessions = await listActiveSessions(env, { projectId: 'p1' });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].status).toBe('active');
    });
  });

  describe('joinSession', () => {
    it('joins a session', async () => {
      const env = createEnv({ sequence: [
        { max_viewers: 25, status: 'active', remote_control_enabled: 0 },
        null,
        { cnt: 0 },
      ] });
      const result = await joinSession(env, { sessionId: 'cb-1', userId: 'u1' });
      expect(result.id).toMatch(/^cbv_/);
      expect(result.joined).toBe(true);
    });
    it('rejects if session ended', async () => {
      const env = createEnv({ sequence: [{ status: 'ended' }] });
      const result = await joinSession(env, { sessionId: 'cb-1', userId: 'u1' });
      expect(result.error).toBe('session_not_active');
    });
    it('rejects duplicate join', async () => {
      const env = createEnv({ sequence: [
        { max_viewers: 25, status: 'active', remote_control_enabled: 0 },
        { id: 'existing' },
      ] });
      const result = await joinSession(env, { sessionId: 'cb-1', userId: 'u1' });
      expect(result.error).toBe('already_joined');
    });
  });

  describe('leaveSession', () => {
    it('leaves a session', async () => {
      const env = createEnv({ first: { id: 'cbv-1' } });
      const result = await leaveSession(env, { sessionId: 'cb-1', userId: 'u1' });
      expect(result.left).toBe(true);
    });
    it('returns error if not in session', async () => {
      const env = createEnv({ first: null });
      const result = await leaveSession(env, { sessionId: 'cb-1', userId: 'u1' });
      expect(result.error).toBe('not_in_session');
    });
  });

  describe('updateCursor', () => {
    it('updates cursor position', async () => {
      const env = createEnv();
      const result = await updateCursor(env, { sessionId: 'cb-1', userId: 'u1', x: 100, y: 200 });
      expect(result.updated).toBe(1);
    });
  });

  describe('addAnnotation', () => {
    it('adds an annotation', async () => {
      const env = createEnv();
      const result = await addAnnotation(env, { sessionId: 'cb-1', projectId: 'p1', userId: 'u1', type: 'draw', payload: { points: [[10, 20], [30, 40]] } });
      expect(result.id).toMatch(/^cba_/);
    });
  });

  describe('listAnnotations', () => {
    it('returns annotations', async () => {
      const env = createEnv({ all: [{ id: 'cba-1', session_id: 'cb-1', project_id: 'p1', user_id: 'u1', type: 'draw', payload: '{}', page_url: null, created_at: '2026-01-01T00:00:00Z' }] });
      const annotations = await listAnnotations(env, { sessionId: 'cb-1' });
      expect(annotations).toHaveLength(1);
      expect(annotations[0].type).toBe('draw');
    });
  });

  describe('grantRemoteControl', () => {
    it('grants remote control', async () => {
      const env = createEnv();
      const result = await grantRemoteControl(env, { sessionId: 'cb-1', userId: 'u1' });
      expect(result.granted).toBe(1);
    });
  });

  describe('revokeRemoteControl', () => {
    it('revokes remote control', async () => {
      const env = createEnv();
      const result = await revokeRemoteControl(env, { sessionId: 'cb-1', userId: 'u1' });
      expect(result.revoked).toBe(1);
    });
  });

  describe('listViewers', () => {
    it('returns viewers', async () => {
      const env = createEnv({ all: [{ id: 'cbv-1', session_id: 'cb-1', user_id: 'u1', display_name: 'Alice', joined_at: '2026-01-01T00:00:00Z', left_at: null, cursor_x: 100, cursor_y: 200, page_url: null, remote_control: 1, created_at: '2026-01-01T00:00:00Z' }] });
      const viewers = await listViewers(env, { sessionId: 'cb-1' });
      expect(viewers).toHaveLength(1);
      expect(viewers[0].remoteControl).toBe(true);
    });
  });

  describe('getCobrowsingStats', () => {
    it('returns stats', async () => {
      const env = createEnv({ all: [{ status: 'active', count: 5, avg_duration: 300000 }], first: { unique_viewers: 20, total_joins: 30 } });
      const stats = await getCobrowsingStats(env, { projectId: 'p1' });
      expect(stats.totalSessions).toBe(5);
      expect(stats.uniqueViewers).toBe(20);
    });
  });
});
