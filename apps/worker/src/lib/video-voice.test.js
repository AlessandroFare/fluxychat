import { describe, it, expect } from 'vitest';
import { createCallSession, startCall, endCall, getCallSession, listActiveCalls, joinCall, leaveCall, updateParticipant, listParticipants, recordCallEvent, toggleRecording, getCallStats, generateToken } from './video-voice.js';

function createEnv(rows = {}) {
  return {
    DB: {
      prepare(sql) {
        const isSelect = sql.startsWith('SELECT');
        const isInsert = sql.startsWith('INSERT');
        const isUpdate = sql.startsWith('UPDATE');
        const isDelete = sql.startsWith('DELETE');
        return {
          bind() {
            return {
              first: async () => (isSelect ? rows.first || null : null),
              all: async () => (isSelect ? { results: rows.all || [] } : { results: [] }),
              run: async () => (isInsert || isUpdate || isDelete ? { meta: { changes: rows.changes || 1 } } : {}),
            };
          },
        };
      },
    },
  };
}

describe('Video/Voice lib', () => {
  describe('createCallSession', () => {
    it('creates a call session', async () => {
      const env = createEnv();
      const call = await createCallSession(env, { projectId: 'proj-1', roomId: 'room-1', provider: 'livekit', startedBy: 'user-1' });
      expect(call.id).toMatch(/^call_/);
      expect(call.providerRoomId).toMatch(/^room_/);
      expect(call.status).toBe('waiting');
    });
    it('defaults to livekit provider', async () => {
      const env = createEnv();
      const call = await createCallSession(env, { projectId: 'proj-1', roomId: 'room-1' });
      expect(call).toBeDefined();
    });
  });

  describe('startCall', () => {
    it('starts a call', async () => {
      const env = createEnv();
      const result = await startCall(env, { callId: 'call-1' });
      expect(result.started).toBe(1);
    });
  });

  describe('endCall', () => {
    it('ends a call with duration', async () => {
      const env = createEnv({ first: { started_at: new Date(Date.now() - 60000).toISOString() } });
      const result = await endCall(env, { callId: 'call-1' });
      expect(result.ended).toBe(1);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getCallSession', () => {
    it('returns null if not found', async () => {
      const env = createEnv({ first: null });
      const call = await getCallSession(env, { callId: 'nonexistent' });
      expect(call).toBeNull();
    });
  });

  describe('listActiveCalls', () => {
    it('returns active calls', async () => {
      const env = createEnv({ all: [{ id: 'call-1', project_id: 'proj-1', room_id: 'room-1', provider: 'livekit', provider_room_id: 'r-1', status: 'active', started_by: 'u-1', started_at: null, ended_at: null, duration_ms: null, recording_enabled: 0, recording_url: null, max_participants: 50, settings: null, created_at: '2026-01-01T00:00:00Z' }] });
      const calls = await listActiveCalls(env, { projectId: 'proj-1' });
      expect(calls).toHaveLength(1);
      expect(calls[0].id).toBe('call-1');
    });
  });

  describe('joinCall', () => {
    it('joins a call', async () => {
      const env = createEnv({ first: null });
      const result = await joinCall(env, { callId: 'call-1', userId: 'user-1' });
      expect(result.id).toMatch(/^cp_/);
      expect(result.joined).toBe(true);
    });
    it('rejects duplicate join', async () => {
      const env = createEnv({ first: { id: 'cp-1' } });
      const result = await joinCall(env, { callId: 'call-1', userId: 'user-1' });
      expect(result.error).toBe('already_in_call');
    });
  });

  describe('leaveCall', () => {
    it('leaves a call', async () => {
      const env = createEnv({ first: { id: 'cp-1', joined_at: new Date(Date.now() - 60000).toISOString() } });
      const result = await leaveCall(env, { callId: 'call-1', userId: 'user-1' });
      expect(result.left).toBe(true);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
    it('returns error if not in call', async () => {
      const env = createEnv({ first: null });
      const result = await leaveCall(env, { callId: 'call-1', userId: 'user-1' });
      expect(result.error).toBe('not_in_call');
    });
  });

  describe('listParticipants', () => {
    it('returns participants', async () => {
      const env = createEnv({ all: [{ id: 'cp-1', call_id: 'c-1', user_id: 'u-1', display_name: 'Alice', joined_at: '2026-01-01T00:00:00Z', left_at: null, duration_ms: null, audio_enabled: 1, video_enabled: 1, screen_sharing: 0, role: 'host', created_at: '2026-01-01T00:00:00Z' }] });
      const participants = await listParticipants(env, { callId: 'call-1' });
      expect(participants).toHaveLength(1);
      expect(participants[0].role).toBe('host');
    });
  });

  describe('toggleRecording', () => {
    it('enables recording', async () => {
      const env = createEnv();
      const result = await toggleRecording(env, { callId: 'call-1', enabled: true });
      expect(result.updated).toBe(1);
    });
  });

  describe('getCallStats', () => {
    it('returns stats', async () => {
      const env = createEnv({ all: [{ status: 'active', count: 3, avg_duration: 120000 }], first: { unique_users: 10, total_joins: 15 } });
      const stats = await getCallStats(env, { projectId: 'proj-1' });
      expect(stats.totalCalls).toBe(3);
      expect(stats.uniqueUsers).toBe(10);
    });
  });

  describe('generateToken', () => {
    it('generates livekit token', () => {
      const t = generateToken('livekit', { roomId: 'r-1', userId: 'u-1' });
      expect(t.provider).toBe('livekit');
    });
    it('generates daily token', () => {
      const t = generateToken('daily', { roomId: 'r-1', userId: 'u-1' });
      expect(t.provider).toBe('daily');
    });
    it('generates custom token', () => {
      const t = generateToken('custom', { roomId: 'r-1', userId: 'u-1' });
      expect(t.provider).toBe('custom');
    });
  });

  describe('recordCallEvent', () => {
    it('records an event', async () => {
      const env = createEnv();
      const result = await recordCallEvent(env, { callId: 'c-1', projectId: 'p-1', eventType: 'join', userId: 'u-1' });
      expect(result.id).toMatch(/^ce_/);
    });
  });

  describe('updateParticipant', () => {
    it('updates audio/video settings', async () => {
      const env = createEnv();
      const result = await updateParticipant(env, { callId: 'call-1', userId: 'user-1', audioEnabled: false, videoEnabled: false });
      expect(result.updated).toBe(1);
    });
    it('returns 0 if no fields to update', async () => {
      const env = createEnv();
      const result = await updateParticipant(env, { callId: 'call-1', userId: 'user-1' });
      expect(result.updated).toBe(0);
    });
  });
});
