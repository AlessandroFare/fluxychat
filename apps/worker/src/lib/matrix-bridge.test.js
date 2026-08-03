import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./message-import.js', () => ({
  importAdminMessage: vi.fn(async () => ({ imported: true, messageId: 42 })),
}));

import { importAdminMessage } from './message-import.js';
import { createMatrixBridge, connectMatrixBridge, disconnectMatrixBridge, getMatrixBridge, listMatrixBridges, deleteMatrixBridge, createMatrixRoomMapping, listMatrixRoomMappings, getMatrixMappingByFluxyRoom, getMatrixMappingByMatrixRoom, deleteMatrixRoomMapping, mapMatrixMessage, findMatrixEvent, findFluxyMessageByMatrix, recordMatrixSyncLog, syncMatrixInbound, syncMatrixOutbound, getMatrixBridgeStats, processMatrixAppserviceTransaction, verifyMatrixAppserviceToken, extractBearerTokenFromRequest } from './matrix-bridge.js';

beforeEach(() => {
  vi.mocked(importAdminMessage).mockResolvedValue({ imported: true, messageId: 42 });
});

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

describe('matrix-bridge lib', () => {
  describe('createMatrixBridge', () => {
    it('creates a bridge', async () => {
      const env = createEnv();
      const result = await createMatrixBridge(env, { projectId: 'p1', homeserverUrl: 'https://matrix.example.com' });
      expect(result.id).toMatch(/^mb_/);
      expect(result.status).toBe('disconnected');
      expect(result.appserviceToken).toMatch(/^as_/);
      expect(result.appserviceWebhookPath).toMatch(/^\/webhooks\/matrix\//);
    });
  });

  describe('verifyMatrixAppserviceToken', () => {
    it('accepts matching tokens', () => {
      expect(verifyMatrixAppserviceToken('as_secret123', 'as_secret123')).toBe(true);
    });

    it('rejects mismatched tokens', () => {
      expect(verifyMatrixAppserviceToken('as_wrong', 'as_secret123')).toBe(false);
    });

    it('extracts bearer token from request', () => {
      const req = { headers: { get: (k) => (k === 'Authorization' ? 'Bearer as_tok' : null) } };
      expect(extractBearerTokenFromRequest(req)).toBe('as_tok');
    });
  });

  describe('connectMatrixBridge', () => {
    it('connects', async () => {
      const env = createEnv({
        first: {
          id: 'mb-1',
          project_id: 'p1',
          homeserver_url: 'https://matrix.example.com',
          access_token: null,
          bot_user_id: null,
          bot_display_name: null,
          sync_mode: 'bidirectional',
          status: 'disconnected',
          settings: null,
          last_sync_at: null,
          error_message: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      });
      const result = await connectMatrixBridge(env, { bridgeId: 'mb-1', skipHealthCheck: true });
      expect(result.connected).toBe(1);
    });
  });

  describe('disconnectMatrixBridge', () => {
    it('disconnects', async () => {
      const env = createEnv();
      const result = await disconnectMatrixBridge(env, { bridgeId: 'mb-1' });
      expect(result.disconnected).toBe(1);
    });
  });

  describe('getMatrixBridge', () => {
    it('returns null if not found', async () => {
      const env = createEnv({ first: null });
      const bridge = await getMatrixBridge(env, { bridgeId: 'x' });
      expect(bridge).toBeNull();
    });
    it('masks access token', async () => {
      const env = createEnv({ first: { id: 'mb-1', project_id: 'p1', homeserver_url: 'https://m.example.com', access_token: 'secret', bot_user_id: '@bot:example.com', bot_display_name: 'Bot', sync_mode: 'bidirectional', status: 'connected', settings: null, last_sync_at: null, error_message: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' } });
      const bridge = await getMatrixBridge(env, { bridgeId: 'mb-1' });
      expect(bridge.accessToken).toBe('•••');
    });
  });

  describe('listMatrixBridges', () => {
    it('returns bridges', async () => {
      const env = createEnv({ all: [{ id: 'mb-1', project_id: 'p1', homeserver_url: 'https://m.example.com', access_token: null, bot_user_id: null, bot_display_name: null, sync_mode: 'bidirectional', status: 'connected', settings: null, last_sync_at: null, error_message: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }] });
      const bridges = await listMatrixBridges(env, { projectId: 'p1' });
      expect(bridges).toHaveLength(1);
    });
  });

  describe('deleteMatrixBridge', () => {
    it('cascades and deletes', async () => {
      const env = createEnv();
      const result = await deleteMatrixBridge(env, { bridgeId: 'mb-1' });
      expect(result.deleted).toBe(1);
    });
  });

  describe('createMatrixRoomMapping', () => {
    it('creates a mapping', async () => {
      const env = createEnv();
      const result = await createMatrixRoomMapping(env, { bridgeId: 'mb-1', projectId: 'p1', fluxychatRoomId: 'r1', matrixRoomId: '!abc:example.com' });
      expect(result.id).toMatch(/^mmr_/);
    });
  });

  describe('listMatrixRoomMappings', () => {
    it('returns mappings', async () => {
      const env = createEnv({ all: [{ id: 'mmr-1', bridge_id: 'mb-1', project_id: 'p1', fluxychat_room_id: 'r1', matrix_room_id: '!abc:example.com', matrix_space_id: null, sync_reactions: 1, sync_attachments: 1, created_at: '2026-01-01T00:00:00Z' }] });
      const mappings = await listMatrixRoomMappings(env, { bridgeId: 'mb-1' });
      expect(mappings).toHaveLength(1);
      expect(mappings[0].matrixRoomId).toBe('!abc:example.com');
    });
  });

  describe('mapMatrixMessage', () => {
    it('maps a message', async () => {
      const env = createEnv();
      const result = await mapMatrixMessage(env, { bridgeId: 'mb-1', projectId: 'p1', fluxychatMessageId: 'fc-1', matrixEventId: '$evt1:example.com', matrixRoomId: '!abc:example.com', direction: 'inbound' });
      expect(result.id).toMatch(/^mmm_/);
    });
  });

  describe('findMatrixEvent', () => {
    it('finds by FC ID', async () => {
      const env = createEnv({ first: { id: 'mmm-1', bridge_id: 'mb-1', project_id: 'p1', fluxychat_message_id: 'fc-1', matrix_event_id: '$evt1:example.com', matrix_room_id: '!abc:example.com', direction: 'inbound', synced_at: '2026-01-01T00:00:00Z' } });
      const msg = await findMatrixEvent(env, { fluxychatMessageId: 'fc-1' });
      expect(msg.matrixEventId).toBe('$evt1:example.com');
    });
  });

  describe('findFluxyMessageByMatrix', () => {
    it('finds by Matrix event ID', async () => {
      const env = createEnv({ first: { id: 'mmm-1', bridge_id: 'mb-1', project_id: 'p1', fluxychat_message_id: 'fc-1', matrix_event_id: '$evt1:example.com', matrix_room_id: '!abc:example.com', direction: 'inbound', synced_at: '2026-01-01T00:00:00Z' } });
      const msg = await findFluxyMessageByMatrix(env, { matrixEventId: '$evt1:example.com' });
      expect(msg.fluxychatMessageId).toBe('fc-1');
    });
  });

  describe('recordMatrixSyncLog', () => {
    it('records a log entry', async () => {
      const env = createEnv();
      const result = await recordMatrixSyncLog(env, { bridgeId: 'mb-1', projectId: 'p1', eventType: 'message', direction: 'inbound' });
      expect(result.id).toMatch(/^msl_/);
    });
  });

  describe('syncMatrixInbound', () => {
    it('syncs when mapping exists', async () => {
      const env = createEnv({ sequence: [
        { id: 'mmr-1', fluxychat_room_id: 'room-1' },
        null,
      ] });
      const result = await syncMatrixInbound(env, { bridgeId: 'mb-1', projectId: 'p1', matrixEventId: '$evt1', matrixRoomId: '!abc', senderId: '@user:example.com', content: 'hello' });
      expect(result.roomId).toBe('room-1');
      expect(result.content).toBe('hello');
      expect(result.messageId).toBe(42);
      expect(importAdminMessage).toHaveBeenCalled();
    });
    it('returns error if no mapping', async () => {
      const env = createEnv({ sequence: [null] });
      const result = await syncMatrixInbound(env, { bridgeId: 'mb-1', projectId: 'p1', matrixEventId: '$evt1', matrixRoomId: '!abc', content: 'hello' });
      expect(result.error).toBe('no_mapping');
    });
    it('returns error if already synced', async () => {
      const env = createEnv({ sequence: [
        { id: 'mmr-1', fluxychat_room_id: 'room-1' },
        { id: 'existing' },
      ] });
      const result = await syncMatrixInbound(env, { bridgeId: 'mb-1', projectId: 'p1', matrixEventId: '$evt1', matrixRoomId: '!abc', content: 'hello' });
      expect(result.error).toBe('already_synced');
    });
  });

  describe('syncMatrixOutbound', () => {
    it('syncs when mapping exists', async () => {
      const env = createEnv({ sequence: [
        { id: 'mmr-1' },
        null,
      ] });
      const result = await syncMatrixOutbound(env, { bridgeId: 'mb-1', projectId: 'p1', fluxychatMessageId: 'fc-1', matrixRoomId: '!abc', content: 'world' });
      expect(result.matrixRoomId).toBe('!abc');
      expect(result.content).toBe('world');
    });
    it('returns error if no mapping', async () => {
      const env = createEnv({ sequence: [null] });
      const result = await syncMatrixOutbound(env, { bridgeId: 'mb-1', projectId: 'p1', fluxychatMessageId: 'fc-1', matrixRoomId: '!abc', content: 'world' });
      expect(result.error).toBe('no_mapping');
    });
    it('returns error if already synced', async () => {
      const env = createEnv({ sequence: [
        { id: 'mmr-1' },
        { id: 'existing' },
      ] });
      const result = await syncMatrixOutbound(env, { bridgeId: 'mb-1', projectId: 'p1', fluxychatMessageId: 'fc-1', matrixRoomId: '!abc', content: 'world' });
      expect(result.error).toBe('already_synced');
    });
    it('POSTs to homeserver when bridge token configured', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({ event_id: '$evt_123' }),
      }));
      vi.stubGlobal('fetch', fetchMock);
      const env = createEnv({ sequence: [
        { id: 'mmr-1' },
        null,
        { homeserver_url: 'https://matrix.example.com', access_token: 'tok' },
      ] });
      const result = await syncMatrixOutbound(env, { bridgeId: 'mb-1', projectId: 'p1', fluxychatMessageId: 'fc-1', matrixRoomId: '!abc', content: 'world' });
      expect(result.sent).toBe(true);
      expect(result.matrixEventId).toBe('$evt_123');
      expect(fetchMock).toHaveBeenCalled();
      vi.unstubAllGlobals();
    });
  });

  describe('getMatrixBridgeStats', () => {
    it('returns stats', async () => {
      const env = createEnv({ all: [{ status: 'connected', count: 1 }], first: { cnt: 3 } });
      const stats = await getMatrixBridgeStats(env, { projectId: 'p1' });
      expect(stats.totalBridges).toBe(1);
      expect(stats.totalMappings).toBe(3);
    });
  });

  describe('processMatrixAppserviceTransaction', () => {
    it('imports text message events', async () => {
      const env = createEnv({ sequence: [
        { id: 'mmr-1', fluxychat_room_id: 'room-1' },
        null,
      ] });
      const result = await processMatrixAppserviceTransaction(env, {
        bridgeId: 'mb-1',
        projectId: 'p1',
        transaction: {
          events: [{
            type: 'm.room.message',
            event_id: '$evt1',
            room_id: '!abc',
            sender: '@user:example.com',
            content: { msgtype: 'm.text', body: 'hello matrix' },
            origin_server_ts: 1_700_000_000_000,
          }],
        },
      });
      expect(result.ok).toBe(true);
      expect(result.count).toBe(1);
      expect(result.processed[0].messageId).toBe(42);
    });

    it('ignores non-text events', async () => {
      const env = createEnv();
      const result = await processMatrixAppserviceTransaction(env, {
        bridgeId: 'mb-1',
        projectId: 'p1',
        transaction: {
          events: [{
            type: 'm.room.message',
            event_id: '$evt2',
            room_id: '!abc',
            sender: '@user:example.com',
            content: { msgtype: 'm.image', body: 'image.png' },
          }],
        },
      });
      expect(result.ok).toBe(true);
      expect(result.count).toBe(0);
      expect(result.ignored[0].reason).toBe('unsupported_msgtype');
    });
  });

  describe('getMatrixMappingByFluxyRoom', () => {
    it('returns mappings for a room', async () => {
      const env = createEnv({ all: [{ id: 'mmr-1', bridge_id: 'mb-1', project_id: 'p1', fluxychat_room_id: 'r1', matrix_room_id: '!abc:example.com', matrix_space_id: null, sync_reactions: 1, sync_attachments: 1, created_at: '2026-01-01T00:00:00Z' }] });
      const mappings = await getMatrixMappingByFluxyRoom(env, { roomId: 'r1' });
      expect(mappings).toHaveLength(1);
    });
  });

  describe('deleteMatrixRoomMapping', () => {
    it('deletes', async () => {
      const env = createEnv();
      const result = await deleteMatrixRoomMapping(env, { mappingId: 'mmr-1' });
      expect(result.deleted).toBe(1);
    });
  });
});
