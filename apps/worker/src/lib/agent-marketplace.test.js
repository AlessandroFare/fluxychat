import { describe, it, expect } from "vitest";
import {
  publishAgent, updateAgent, submitForReview, reviewAgent,
  getAgent, getAgentBySlug, listAgents,
  installAgent, uninstallAgent, listInstalledAgents,
  addReview, listReviews, getMarketplaceStats,
} from "./agent-marketplace.js";

function makeEnv() {
  const agents = [];
  const installs = [];
  const reviews = [];
  return {
    DB: {
      prepare: (sql) => {
        const h = (params) => ({
          first: async () => {
            if (sql.includes("COUNT(*) as agents")) {
              const published = agents.filter((a) => a.status === "published");
              return { agents: published.length, installs: published.reduce((s, a) => s + a.install_count, 0), rating: published.length ? published.reduce((s, a) => s + a.avg_rating, 0) / published.length : 0 };
            }
            if (sql.includes("AVG(rating)")) {
              const agentReviews = reviews.filter((r) => r.agent_id === params[0]);
              const avg = agentReviews.length ? agentReviews.reduce((s, r) => s + r.rating, 0) / agentReviews.length : 0;
              return { avg, count: agentReviews.length };
            }
            if (sql.includes("slug")) {
              return agents.find((a) => a.slug === params[0]) || null;
            }
            if (sql.includes("agent_marketplace") && sql.includes("WHERE id")) {
              return agents.find((a) => a.id === params[0]) || null;
            }
            return null;
          },
          all: async () => {
            if (sql.includes("GROUP BY category")) {
              const groups = {};
              for (const a of agents.filter((a) => a.status === "published")) {
                if (!groups[a.category]) groups[a.category] = { category: a.category, count: 0, installs: 0 };
                groups[a.category].count++;
                groups[a.category].installs += a.install_count;
              }
              return { results: Object.values(groups) };
            }
            if (sql.includes("agent_marketplace") && sql.includes("status = ?")) {
              let filtered = agents.filter((a) => a.status === params[0] || !params[0]);
              return { results: filtered };
            }
            if (sql.includes("agent_marketplace") && sql.includes("slug")) {
              return { results: agents.filter((a) => a.slug === params[0]) };
            }
            if (sql.includes("agent_marketplace") && !sql.includes("GROUP")) {
              return { results: agents.filter((a) => a.id === params[0]) };
            }
            if (sql.includes("agent_marketplace_installs")) return { results: installs.filter((i) => i.project_id === params[0]) };
            if (sql.includes("agent_marketplace_reviews")) return { results: reviews.filter((r) => r.agent_id === params[0]) };
            return { results: [] };
          },
          run: async () => {
            if (sql.includes("INSERT INTO agent_marketplace_installs")) {
              const exists = installs.find((i) => i.agent_id === params[1] && i.project_id === params[2]);
              if (exists) throw new Error("UNIQUE constraint");
              installs.push({ id: params[0], agent_id: params[1], project_id: params[2], installed_by: params[3], config_override: params[4], enabled: params[5], installed_at: params[6], updated_at: params[7] });
            } else if (sql.includes("INSERT INTO agent_marketplace_reviews")) {
              const exists = reviews.find((r) => r.agent_id === params[1] && r.project_id === params[2]);
              if (exists) throw new Error("UNIQUE constraint");
              reviews.push({ id: params[0], agent_id: params[1], project_id: params[2], user_id: params[3], rating: params[4], title: params[5], body: params[6], created_at: params[7] });
            } else if (sql.includes("INSERT INTO agent_marketplace")) {
              const exists = agents.find((a) => a.slug === params[3]);
              if (exists) throw new Error("UNIQUE constraint");
              agents.push({
                id: params[0], publisher_id: params[1], name: params[2], slug: params[3],
                description: params[4], long_description: params[5], category: params[6],
                icon_url: params[7], config_template: params[8], system_prompt: params[9],
                tools: params[10], integrations: params[11], pricing: params[12],
                pricing_config: params[13], version: params[14], status: "draft",
                install_count: 0, avg_rating: 0, review_count: 0, featured: 0,
                tags: params[16], created_at: params[17], updated_at: params[18],
              });
            } else if (sql.includes("DELETE FROM agent_marketplace_installs")) {
              const before = installs.length;
              for (let i = installs.length - 1; i >= 0; i--) {
                if (installs[i].agent_id === params[0] && installs[i].project_id === params[1]) installs.splice(i, 1);
              }
              return { meta: { changes: before - installs.length } };
            } else if (sql.includes("UPDATE agent_marketplace") && sql.includes("install_count")) {
              const a = agents.find((a) => a.id === params[params.length - 1]);
              if (a) a.install_count++;
            } else if (sql.includes("UPDATE agent_marketplace") && sql.includes("status")) {
              const a = agents.find((a) => a.id === params[params.length - 1]);
              if (a) a.status = params[0];
            } else if (sql.includes("UPDATE agent_marketplace") && sql.includes("avg_rating")) {
              const a = agents.find((a) => a.id === params[params.length - 1]);
              if (a) { a.avg_rating = params[0]; a.review_count = params[1]; }
            }
            return { meta: { changes: 1 } };
          },
        });
        const noArgs = h([]);
        return { bind: (...args) => h(args), all: noArgs.all, first: noArgs.first };
      },
    },
    _agents: agents,
    _installs: installs,
    _reviews: reviews,
  };
}

describe("agent-marketplace", () => {
  describe("publishAgent", () => {
    it("creates an agent listing", async () => {
      const env = makeEnv();
      const result = await publishAgent(env, { publisherId: "u1", name: "Support Bot", slug: "support-bot", description: "AI support agent" });
      expect(result.created).toBe(true);
    });

    it("requires name, slug, publisherId", async () => {
      const env = makeEnv();
      const result = await publishAgent(env, {});
      expect(result.error).toContain("required");
    });

    it("validates category", async () => {
      const env = makeEnv();
      const result = await publishAgent(env, { publisherId: "u1", name: "x", slug: "x", category: "invalid" });
      expect(result.error).toContain("category");
    });

    it("rejects duplicate slug", async () => {
      const env = makeEnv();
      await publishAgent(env, { publisherId: "u1", name: "A", slug: "bot" });
      const result = await publishAgent(env, { publisherId: "u2", name: "B", slug: "bot" });
      expect(result.error).toContain("already_exists");
    });
  });

  describe("install/uninstall", () => {
    it("installs an agent", async () => {
      const env = makeEnv();
      const { id } = await publishAgent(env, { publisherId: "u1", name: "Bot", slug: "bot" });
      await reviewAgent(env, { id, status: "published" });
      const result = await installAgent(env, { agentId: id, projectId: "p1", installedBy: "admin" });
      expect(result.installed).toBe(true);
    });

    it("cannot install unpublished agent", async () => {
      const env = makeEnv();
      const { id } = await publishAgent(env, { publisherId: "u1", name: "Bot", slug: "bot" });
      const result = await installAgent(env, { agentId: id, projectId: "p1", installedBy: "admin" });
      expect(result.error).toContain("not_published");
    });

    it("rejects duplicate install", async () => {
      const env = makeEnv();
      const { id } = await publishAgent(env, { publisherId: "u1", name: "Bot", slug: "bot" });
      await reviewAgent(env, { id, status: "published" });
      await installAgent(env, { agentId: id, projectId: "p1", installedBy: "admin" });
      const result = await installAgent(env, { agentId: id, projectId: "p1", installedBy: "admin" });
      expect(result.error).toContain("already_installed");
    });

    it("uninstalls an agent", async () => {
      const env = makeEnv();
      const { id } = await publishAgent(env, { publisherId: "u1", name: "Bot", slug: "bot" });
      await reviewAgent(env, { id, status: "published" });
      await installAgent(env, { agentId: id, projectId: "p1", installedBy: "admin" });
      const result = await uninstallAgent(env, { agentId: id, projectId: "p1" });
      expect(result.uninstalled).toBe(1);
    });
  });

  describe("reviews", () => {
    it("adds a review", async () => {
      const env = makeEnv();
      const result = await addReview(env, { agentId: "a1", projectId: "p1", userId: "u1", rating: 5, title: "Great!" });
      expect(result.created).toBe(true);
    });

    it("validates rating", async () => {
      const env = makeEnv();
      const result = await addReview(env, { agentId: "a1", projectId: "p1", userId: "u1", rating: 6 });
      expect(result.error).toContain("1-5");
    });

    it("rejects duplicate review", async () => {
      const env = makeEnv();
      await addReview(env, { agentId: "a1", projectId: "p1", userId: "u1", rating: 5 });
      const result = await addReview(env, { agentId: "a1", projectId: "p1", userId: "u1", rating: 4 });
      expect(result.error).toContain("already_reviewed");
    });
  });

  describe("getMarketplaceStats", () => {
    it("returns stats", async () => {
      const env = makeEnv();
      const { id } = await publishAgent(env, { publisherId: "u1", name: "Bot", slug: "bot", category: "support" });
      await reviewAgent(env, { id, status: "published" });
      const stats = await getMarketplaceStats(env);
      expect(stats.totalAgents).toBe(1);
    });
  });
});
