import { describe, it, expect } from 'vitest';
import { createCompanion, updateCompanion, getCompanion, listCompanions, deleteCompanion, assignToRoom, unassignFromRoom, listCompanionRooms, listCompanionsInRoom, recordInteraction, listInteractions, addMemory, searchMemory, getCompanionStats } from './ai-companions.js';

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

describe('ai-companions lib', () => {
  describe('createCompanion', () => {
    it('creates a companion', async () => {
      const env = createEnv();
      const result = await createCompanion(env, { projectId: 'p1', name: 'Alex', systemPrompt: 'You are helpful.' });
      expect(result.id).toMatch(/^acp_/);
      expect(result.status).toBe('active');
    });
  });

  describe('updateCompanion', () => {
    it('updates fields', async () => {
      const env = createEnv();
      const result = await updateCompanion(env, { companionId: 'acp-1', name: 'New Name', status: 'paused' });
      expect(result.updated).toBe(1);
    });
    it('returns 0 if no fields', async () => {
      const env = createEnv();
      const result = await updateCompanion(env, { companionId: 'acp-1' });
      expect(result.updated).toBe(0);
    });
  });

  describe('getCompanion', () => {
    it('returns null if not found', async () => {
      const env = createEnv({ first: null });
      const result = await getCompanion(env, { companionId: 'x' });
      expect(result).toBeNull();
    });
    it('parses personality and skills', async () => {
      const env = createEnv({ first: { id: 'acp-1', project_id: 'p1', name: 'Alex', avatar_url: null, description: null, system_prompt: 'Hi', personality: '{"friendly":true}', skills: '["summarize"]', trigger_mode: 'mention', trigger_keywords: null, temperature: 0.7, max_tokens: 1024, model: null, status: 'active', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' } });
      const c = await getCompanion(env, { companionId: 'acp-1' });
      expect(c.personality).toEqual({ friendly: true });
      expect(c.skills).toEqual(['summarize']);
    });
  });

  describe('listCompanions', () => {
    it('returns companions', async () => {
      const env = createEnv({ all: [{ id: 'acp-1', project_id: 'p1', name: 'Alex', avatar_url: null, description: null, system_prompt: 'Hi', personality: null, skills: null, trigger_mode: 'mention', trigger_keywords: null, temperature: 0.7, max_tokens: 1024, model: null, status: 'active', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }] });
      const list = await listCompanions(env, { projectId: 'p1' });
      expect(list).toHaveLength(1);
    });
  });

  describe('deleteCompanion', () => {
    it('cascades and deletes', async () => {
      const env = createEnv();
      const result = await deleteCompanion(env, { companionId: 'acp-1' });
      expect(result.deleted).toBe(1);
    });
  });

  describe('assignToRoom', () => {
    it('assigns to room', async () => {
      const env = createEnv({ first: null });
      const result = await assignToRoom(env, { companionId: 'acp-1', projectId: 'p1', roomId: 'r1' });
      expect(result.id).toMatch(/^acr_/);
    });
    it('rejects duplicate', async () => {
      const env = createEnv({ first: { id: 'existing' } });
      const result = await assignToRoom(env, { companionId: 'acp-1', projectId: 'p1', roomId: 'r1' });
      expect(result.error).toBe('already_assigned');
    });
  });

  describe('unassignFromRoom', () => {
    it('removes from room', async () => {
      const env = createEnv();
      const result = await unassignFromRoom(env, { companionId: 'acp-1', roomId: 'r1' });
      expect(result.removed).toBe(1);
    });
  });

  describe('listCompanionRooms', () => {
    it('returns rooms', async () => {
      const env = createEnv({ all: [{ id: 'acr-1', companion_id: 'acp-1', project_id: 'p1', room_id: 'r1', is_active: 1, join_message: null, leave_message: null, custom_prompt_override: null, created_at: '2026-01-01T00:00:00Z' }] });
      const rooms = await listCompanionRooms(env, { companionId: 'acp-1' });
      expect(rooms).toHaveLength(1);
      expect(rooms[0].isActive).toBe(true);
    });
  });

  describe('listCompanionsInRoom', () => {
    it('returns companions in room', async () => {
      const env = createEnv({ all: [{ id: 'acr-1', companion_id: 'acp-1', project_id: 'p1', room_id: 'r1', is_active: 1, join_message: null, leave_message: null, custom_prompt_override: null, created_at: '2026-01-01T00:00:00Z' }] });
      const list = await listCompanionsInRoom(env, { roomId: 'r1' });
      expect(list).toHaveLength(1);
    });
  });

  describe('recordInteraction', () => {
    it('records an interaction', async () => {
      const env = createEnv();
      const result = await recordInteraction(env, { companionId: 'acp-1', projectId: 'p1', roomId: 'r1', inputText: 'hello', outputText: 'hi there' });
      expect(result.id).toMatch(/^aci_/);
    });
  });

  describe('listInteractions', () => {
    it('returns interactions', async () => {
      const env = createEnv({ all: [{ id: 'aci-1', companion_id: 'acp-1', project_id: 'p1', room_id: 'r1', user_id: 'u1', input_text: 'hello', output_text: 'hi', tokens_used: 50, latency_ms: 200, triggered_by: 'mention', created_at: '2026-01-01T00:00:00Z' }] });
      const list = await listInteractions(env, { companionId: 'acp-1' });
      expect(list).toHaveLength(1);
      expect(list[0].tokensUsed).toBe(50);
    });
  });

  describe('addMemory', () => {
    it('adds memory', async () => {
      const env = createEnv();
      const result = await addMemory(env, { companionId: 'acp-1', projectId: 'p1', content: 'User likes cats' });
      expect(result.id).toMatch(/^acm_/);
    });
  });

  describe('searchMemory', () => {
    it('searches memory by content', async () => {
      const env = createEnv({ all: [{ id: 'acm-1', companion_id: 'acp-1', project_id: 'p1', room_id: 'r1', memory_type: 'fact', content: 'User likes cats', source: null, importance: 0.8, expires_at: null, created_at: '2026-01-01T00:00:00Z' }] });
      const results = await searchMemory(env, { companionId: 'acp-1', query: 'cats' });
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('User likes cats');
    });
  });

  describe('getCompanionStats', () => {
    it('returns stats', async () => {
      const env = createEnv({ all: [{ status: 'active', count: 3 }], first: { total: 100, avg_tokens: 150, avg_latency: 300 } });
      const stats = await getCompanionStats(env, { projectId: 'p1' });
      expect(stats.totalCompanions).toBe(3);
      expect(stats.totalInteractions).toBe(100);
      expect(stats.avgTokens).toBe(150);
    });
  });
});
