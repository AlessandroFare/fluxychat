import { describe, it, expect } from "vitest";
import {
  canManageChannels,
  canViewInbox,
  listChannelConfigs,
  getChannelConfig,
  createChannelConfig,
  updateChannelConfig,
  deleteChannelConfig,
  listRoutingRules,
  createRoutingRule,
  updateRoutingRule,
  deleteRoutingRule,
  resolveRouting,
  linkThread,
  getThreadLinks,
  getRoomByExternalThread,
  getUnifiedInbox,
} from "./omnichannel.js";

function createMockDb({ configs = [], rules = [], links = [], rooms = [], messages = [] } = {}) {
  let nextId = 1;
  return {
    configs, rules, links, rooms, messages,
    prepare(sql) {
      const self = this;
      return {
        bind(...args) {
          return {
            async all() {
              if (sql.includes("FROM channel_configs")) return { results: self.configs };
              if (sql.includes("FROM channel_routing_rules") && sql.includes("INNER JOIN channel_configs")) {
                return { results: self.rules.filter((r) => r.project_id === args[0] && r.enabled === 1) };
              }
              if (sql.includes("FROM channel_routing_rules")) return { results: self.rules };
              if (sql.includes("FROM channel_thread_links") && sql.includes("external_thread_id")) {
                const link = self.links.find((l) => l.project_id === args[0] && l.channel_type === args[1] && l.external_thread_id === args[2]);
                return link ? { room_id: link.room_id } : null;
              }
              if (sql.includes("FROM channel_thread_links")) return { results: self.links.filter((l) => l.project_id === args[0] && l.room_id === args[1]) };
              if (sql.includes("FROM rooms") && sql.includes("room_members")) return { results: self.rooms };
              if (sql.includes("FROM rooms") && sql.includes("channel_thread_links")) return { results: [] };
              if (sql.includes("FROM messages")) return self.messages[0] || null;
              return { results: [] };
            },
            async first() {
              if (sql.includes("FROM channel_configs")) {
                return self.configs.find((c) => c.id === args[0] && c.project_id === args[1]) || null;
              }
              if (sql.includes("FROM channel_thread_links") && sql.includes("room_id")) {
                const link = self.links.find((l) => l.project_id === args[0] && l.room_id === args[1]);
                return link || null;
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO channel_configs")) {
                const config = { id: `cfg_${nextId++}`, project_id: args[1], channel_type: args[2], channel_name: args[3], enabled: args[4], settings: args[5], created_at: args[6], updated_at: args[7] };
                self.configs.push(config);
                return { meta: { changes: 1 } };
              }
              if (sql.includes("UPDATE channel_configs")) {
                const c = self.configs.find((x) => x.id === args[args.length - 2] && x.project_id === args[args.length - 1]);
                if (c) { if (args[0]) c.channel_name = args[0]; }
                return { meta: { changes: c ? 1 : 0 } };
              }
              if (sql.includes("DELETE FROM channel_routing_rules")) {
                const before = self.rules.length;
                self.rules = self.rules.filter((r) => r.channel_config_id !== args[0] || r.project_id !== args[1]);
                return { meta: { changes: before - self.rules.length } };
              }
              if (sql.includes("DELETE FROM channel_configs")) {
                const before = self.configs.length;
                self.configs = self.configs.filter((c) => c.id !== args[0] || c.project_id !== args[1]);
                return { meta: { changes: before - self.configs.length } };
              }
              if (sql.includes("INSERT INTO channel_routing_rules")) {
                const rule = { id: `rule_${nextId++}`, project_id: args[1], channel_config_id: args[2], rule_name: args[3], match_pattern: args[4], target_room_id: args[5], target_room_pattern: args[6], priority: args[7], enabled: args[8], created_at: args[9], updated_at: args[10] };
                self.rules.push(rule);
                return { meta: { changes: 1 } };
              }
              if (sql.includes("UPDATE channel_routing_rules")) {
                const r = self.rules.find((x) => x.id === args[args.length - 2] && x.project_id === args[args.length - 1]);
                if (r && args[0]) r.rule_name = args[0];
                return { meta: { changes: r ? 1 : 0 } };
              }
              if (sql.includes("INSERT INTO channel_thread_links")) {
                const link = { id: `link_${nextId++}`, project_id: args[1], room_id: args[2], channel_type: args[3], external_thread_id: args[4], external_user_id: args[5], external_user_name: args[6], linked_at: args[7] };
                self.links.push(link);
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };
}

describe("omnichannel", () => {
  describe("canManageChannels", () => {
    it("allows owner", () => expect(canManageChannels(["owner"])).toBe(true));
    it("allows admin", () => expect(canManageChannels(["admin"])).toBe(true));
    it("rejects moderator", () => expect(canManageChannels(["moderator"])).toBe(false));
    it("rejects undefined", () => expect(canManageChannels(undefined)).toBe(false));
  });

  describe("canViewInbox", () => {
    it("allows member", () => expect(canViewInbox(["member"])).toBe(true));
    it("rejects undefined", () => expect(canViewInbox(undefined)).toBe(false));
  });

  describe("createChannelConfig", () => {
    it("creates config", async () => {
      const db = createMockDb();
      const result = await createChannelConfig(db, { projectId: "p1", channelType: "email", channelName: "Support Email" });
      expect(result.ok).toBe(true);
      expect(result.channelType).toBe("email");
    });
    it("rejects invalid type", async () => {
      const db = createMockDb();
      const result = await createChannelConfig(db, { projectId: "p1", channelType: "invalid", channelName: "Test" });
      expect(result.ok).toBe(false);
      expect(result.error).toBe("invalid_channel_type");
    });
    it("rejects empty name", async () => {
      const db = createMockDb();
      const result = await createChannelConfig(db, { projectId: "p1", channelType: "email", channelName: "" });
      expect(result.ok).toBe(false);
    });
  });

  describe("listChannelConfigs", () => {
    it("lists configs", async () => {
      const db = createMockDb({ configs: [{ id: "c1", project_id: "p1", channel_type: "sms", channel_name: "SMS", enabled: 1 }] });
      const configs = await listChannelConfigs(db, { projectId: "p1" });
      expect(configs).toHaveLength(1);
      expect(configs[0].channelType).toBe("sms");
    });
  });

  describe("getChannelConfig", () => {
    it("returns config", async () => {
      const db = createMockDb({ configs: [{ id: "c1", project_id: "p1", channel_type: "email", channel_name: "Email", enabled: 1 }] });
      const config = await getChannelConfig(db, { projectId: "p1", configId: "c1" });
      expect(config).toBeTruthy();
      expect(config.id).toBe("c1");
    });
    it("returns null for missing", async () => {
      const db = createMockDb();
      const config = await getChannelConfig(db, { projectId: "p1", configId: "missing" });
      expect(config).toBeNull();
    });
  });

  describe("deleteChannelConfig", () => {
    it("deletes config", async () => {
      const db = createMockDb({ configs: [{ id: "c1", project_id: "p1" }] });
      const result = await deleteChannelConfig(db, { projectId: "p1", configId: "c1" });
      expect(result.ok).toBe(true);
      expect(result.deleted).toBe(true);
    });
  });

  describe("createRoutingRule", () => {
    it("creates rule", async () => {
      const db = createMockDb();
      const result = await createRoutingRule(db, { projectId: "p1", channelConfigId: "c1", ruleName: "VIP" });
      expect(result.ok).toBe(true);
    });
    it("rejects empty name", async () => {
      const db = createMockDb();
      const result = await createRoutingRule(db, { projectId: "p1", channelConfigId: "c1", ruleName: "" });
      expect(result.ok).toBe(false);
    });
  });

  describe("resolveRouting", () => {
    it("returns target room from rule", async () => {
      const db = createMockDb({
        rules: [{ id: "r1", project_id: "p1", channel_config_id: "c1", rule_name: "VIP", match_pattern: null, target_room_id: "room_vip", target_room_pattern: null, priority: 10, enabled: 1 }],
      });
      const result = await resolveRouting(db, { projectId: "p1", channelType: "email" });
      expect(result.roomId).toBe("room_vip");
    });
    it("returns null when no rules match", async () => {
      const db = createMockDb();
      const result = await resolveRouting(db, { projectId: "p1", channelType: "email" });
      expect(result.roomId).toBeNull();
    });
  });

  describe("linkThread", () => {
    it("links thread to room", async () => {
      const db = createMockDb();
      const result = await linkThread(db, { projectId: "p1", roomId: "r1", channelType: "email", externalThreadId: "ext_123" });
      expect(result.ok).toBe(true);
    });
  });

  describe("getThreadLinks", () => {
    it("returns links for room", async () => {
      const db = createMockDb({ links: [{ id: "l1", project_id: "p1", room_id: "r1", channel_type: "email", external_thread_id: "ext_1" }] });
      const links = await getThreadLinks(db, { projectId: "p1", roomId: "r1" });
      expect(links).toHaveLength(1);
      expect(links[0].channelType).toBe("email");
    });
  });

  describe("getUnifiedInbox", () => {
    it("returns empty when no rooms", async () => {
      const db = createMockDb({ rooms: [] });
      const entries = await getUnifiedInbox(db, { projectId: "p1", userId: "u1" });
      expect(entries).toHaveLength(0);
    });
  });
});
