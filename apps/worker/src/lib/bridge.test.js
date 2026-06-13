import { describe, it, expect } from 'vitest';
import { createBridgeConfig, connectBridge, disconnectBridge, getBridgeConfig, listBridgeConfigs, deleteBridgeConfig, createChannelMapping, listChannelMappings, getChannelMappingByRoom, getChannelMappingByExternal, deleteChannelMapping, mapMessage, findExternalMessage, findFluxychatMessage, recordBridgeEvent, getBridgeStats, syncInboundMessage, syncOutboundMessage } from './bridge.js';

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

describe('bridge lib', () => {
  describe('createBridgeConfig', () => {
    it('creates a bridge config', async () => {
      const env = createEnv();
      const config = await createBridgeConfig(env, { projectId: 'p1', platform: 'slack', name: 'My Slack' });
      expect(config.id).toMatch(/^br_/);
      expect(config.status).toBe('disconnected');
    });
  });

  describe('connectBridge', () => {
    it('connects a bridge', async () => {
      const env = createEnv();
      const result = await connectBridge(env, { bridgeId: 'br-1' });
      expect(result.connected).toBe(1);
    });
  });

  describe('disconnectBridge', () => {
    it('disconnects a bridge', async () => {
      const env = createEnv();
      const result = await disconnectBridge(env, { bridgeId: 'br-1' });
      expect(result.disconnected).toBe(1);
    });
  });

  describe('getBridgeConfig', () => {
    it('returns null if not found', async () => {
      const env = createEnv({ first: null });
      const config = await getBridgeConfig(env, { bridgeId: 'nonexistent' });
      expect(config).toBeNull();
    });
    it('masks token', async () => {
      const env = createEnv({ first: { id: 'br-1', project_id: 'p1', platform: 'slack', name: 'Slack', token: 'secret', webhook_url: null, bot_user_id: 'U1', bot_display_name: 'Bot', status: 'connected', settings: null, last_sync_at: null, error_message: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' } });
      const config = await getBridgeConfig(env, { bridgeId: 'br-1' });
      expect(config.token).toBe('•••');
    });
  });

  describe('listBridgeConfigs', () => {
    it('returns bridges', async () => {
      const env = createEnv({ all: [{ id: 'br-1', project_id: 'p1', platform: 'slack', name: 'Slack', token: null, webhook_url: null, bot_user_id: null, bot_display_name: null, status: 'connected', settings: null, last_sync_at: null, error_message: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }] });
      const bridges = await listBridgeConfigs(env, { projectId: 'p1' });
      expect(bridges).toHaveLength(1);
      expect(bridges[0].platform).toBe('slack');
    });
  });

  describe('deleteBridgeConfig', () => {
    it('deletes a bridge and cascades', async () => {
      const env = createEnv();
      const result = await deleteBridgeConfig(env, { bridgeId: 'br-1' });
      expect(result.deleted).toBe(1);
    });
  });

  describe('createChannelMapping', () => {
    it('creates a mapping', async () => {
      const env = createEnv();
      const result = await createChannelMapping(env, { bridgeId: 'br-1', projectId: 'p1', fluxychatRoomId: 'r1', externalChannelId: 'C123' });
      expect(result.id).toMatch(/^bcm_/);
    });
  });

  describe('listChannelMappings', () => {
    it('returns mappings', async () => {
      const env = createEnv({ all: [{ id: 'bcm-1', bridge_id: 'br-1', project_id: 'p1', fluxychat_room_id: 'r1', external_channel_id: 'C123', external_channel_name: 'general', sync_direction: 'both', sync_reactions: 1, sync_attachments: 1, auto_reply: 0, created_at: '2026-01-01T00:00:00Z' }] });
      const mappings = await listChannelMappings(env, { bridgeId: 'br-1' });
      expect(mappings).toHaveLength(1);
      expect(mappings[0].syncReactions).toBe(true);
    });
  });

  describe('mapMessage', () => {
    it('maps a message', async () => {
      const env = createEnv();
      const result = await mapMessage(env, { bridgeId: 'br-1', projectId: 'p1', fluxychatMessageId: 'fc-1', externalMessageId: 'ext-1', externalPlatform: 'slack', externalChannelId: 'C1', direction: 'inbound' });
      expect(result.id).toMatch(/^bmm_/);
    });
  });

  describe('findExternalMessage', () => {
    it('finds by FC message ID', async () => {
      const env = createEnv({ first: { id: 'bmm-1', bridge_id: 'br-1', project_id: 'p1', fluxychat_message_id: 'fc-1', external_message_id: 'ext-1', external_platform: 'slack', external_channel_id: 'C1', direction: 'inbound', synced_at: '2026-01-01T00:00:00Z' } });
      const msg = await findExternalMessage(env, { fluxychatMessageId: 'fc-1' });
      expect(msg).toBeDefined();
      expect(msg.externalMessageId).toBe('ext-1');
    });
  });

  describe('findFluxychatMessage', () => {
    it('finds by external message ID', async () => {
      const env = createEnv({ first: { id: 'bmm-1', bridge_id: 'br-1', project_id: 'p1', fluxychat_message_id: 'fc-1', external_message_id: 'ext-1', external_platform: 'slack', external_channel_id: 'C1', direction: 'inbound', synced_at: '2026-01-01T00:00:00Z' } });
      const msg = await findFluxychatMessage(env, { externalMessageId: 'ext-1' });
      expect(msg).toBeDefined();
      expect(msg.fluxychatMessageId).toBe('fc-1');
    });
  });

  describe('recordBridgeEvent', () => {
    it('records an event', async () => {
      const env = createEnv();
      const result = await recordBridgeEvent(env, { bridgeId: 'br-1', projectId: 'p1', eventType: 'message_sync', direction: 'inbound' });
      expect(result.id).toMatch(/^be_/);
    });
  });

  describe('getBridgeStats', () => {
    it('returns stats', async () => {
      const env = createEnv({ all: [{ platform: 'slack', status: 'connected', count: 2 }], first: { cnt: 5 } });
      const stats = await getBridgeStats(env, { projectId: 'p1' });
      expect(stats.bridges).toHaveLength(1);
      expect(stats.totalMappings).toBe(5);
    });
  });

  describe('syncInboundMessage', () => {
    it('syncs inbound when mapping exists', async () => {
      const env = createEnv({ sequence: [
        { id: 'bcm-1', fluxychat_room_id: 'room-1', sync_direction: 'both' },
        null,
      ] });
      const result = await syncInboundMessage(env, { bridgeId: 'br-1', projectId: 'p1', externalMessageId: 'ext-1', externalChannelId: 'C1', content: 'hello' });
      expect(result.roomId).toBe('room-1');
      expect(result.content).toBe('hello');
    });
    it('returns error if no mapping', async () => {
      const env = createEnv({ sequence: [null] });
      const result = await syncInboundMessage(env, { bridgeId: 'br-1', projectId: 'p1', externalMessageId: 'ext-1', externalChannelId: 'C1', content: 'hello' });
      expect(result.error).toBe('no_mapping');
    });
    it('returns error if inbound disabled', async () => {
      const env = createEnv({ sequence: [{ id: 'bcm-1', sync_direction: 'outbound' }] });
      const result = await syncInboundMessage(env, { bridgeId: 'br-1', projectId: 'p1', externalMessageId: 'ext-1', externalChannelId: 'C1', content: 'hello' });
      expect(result.error).toBe('inbound_disabled');
    });
    it('returns error if already synced', async () => {
      const env = createEnv({ sequence: [
        { id: 'bcm-1', sync_direction: 'both' },
        { id: 'existing' },
      ] });
      const result = await syncInboundMessage(env, { bridgeId: 'br-1', projectId: 'p1', externalMessageId: 'ext-1', externalChannelId: 'C1', content: 'hello' });
      expect(result.error).toBe('already_synced');
    });
  });

  describe('syncOutboundMessage', () => {
    it('syncs outbound when mapping exists', async () => {
      const env = createEnv({ sequence: [
        { id: 'bcm-1', project_id: 'p1', sync_direction: 'both' },
        null,
      ] });
      const result = await syncOutboundMessage(env, { bridgeId: 'br-1', projectId: 'p1', fluxychatMessageId: 'fc-1', externalChannelId: 'C1', content: 'world' });
      expect(result.externalChannelId).toBe('C1');
      expect(result.content).toBe('world');
    });
    it('returns error if no mapping', async () => {
      const env = createEnv({ sequence: [null] });
      const result = await syncOutboundMessage(env, { bridgeId: 'br-1', projectId: 'p1', fluxychatMessageId: 'fc-1', externalChannelId: 'C1', content: 'world' });
      expect(result.error).toBe('no_mapping');
    });
    it('returns error if outbound disabled', async () => {
      const env = createEnv({ sequence: [{ id: 'bcm-1', project_id: 'p1', sync_direction: 'inbound' }] });
      const result = await syncOutboundMessage(env, { bridgeId: 'br-1', projectId: 'p1', fluxychatMessageId: 'fc-1', externalChannelId: 'C1', content: 'world' });
      expect(result.error).toBe('outbound_disabled');
    });
  });

  describe('deleteChannelMapping', () => {
    it('deletes a mapping', async () => {
      const env = createEnv();
      const result = await deleteChannelMapping(env, { mappingId: 'bcm-1' });
      expect(result.deleted).toBe(1);
    });
  });
});
