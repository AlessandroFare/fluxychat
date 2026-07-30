export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: "customer_service" | "sales" | "productivity" | "entertainment" | "utility";
  tools: string[];
  promptTemplate?: string;
  tags: string[];
  rating: number;
  installCount: number;
  publishedAt: number;
}

export interface AgentSkillTemplate {
  skillId: string;
  configSchema: Record<string, { type: string; required: boolean; default?: unknown }>;
  defaultConfig: Record<string, unknown>;
}

export interface AgentMarketplace {
  publishSkill(skill: Omit<AgentSkill, "id" | "publishedAt" | "installCount">): AgentSkill;
  getSkill(id: string): AgentSkill | undefined;
  searchSkills(query: { category?: string; tags?: string[]; text?: string }): AgentSkill[];
  installSkill(skillId: string, config?: Record<string, unknown>): { installed: boolean; config: Record<string, unknown> };
  getTemplate(skillId: string): AgentSkillTemplate | undefined;
  listCategories(): string[];
  getTopRated(limit?: number): AgentSkill[];
}

export function createAgentMarketplace(): AgentMarketplace {
  const skills = new Map<string, AgentSkill>();
  const templates = new Map<string, AgentSkillTemplate>();
  let skillCounter = 0;

  return {
    publishSkill(input) {
      const id = `skill-${++skillCounter}`;
      const skill: AgentSkill = { ...input, id, publishedAt: Date.now(), installCount: 0 };
      skills.set(id, skill);
      const template: AgentSkillTemplate = {
        skillId: id,
        configSchema: {},
        defaultConfig: {},
      };
      templates.set(id, template);
      return { ...skill };
    },

    getSkill(id) {
      return skills.get(id);
    },

    searchSkills(query) {
      return Array.from(skills.values()).filter((s) => {
        if (query.category && s.category !== query.category) return false;
        if (query.tags && !query.tags.some((t) => s.tags.includes(t))) return false;
        if (query.text) {
          const lower = query.text.toLowerCase();
          if (!s.name.toLowerCase().includes(lower) && !s.description.toLowerCase().includes(lower)) return false;
        }
        return true;
      });
    },

    installSkill(skillId, config = {}) {
      const skill = skills.get(skillId);
      if (!skill) throw new Error(`Skill "${skillId}" not found`);
      skill.installCount++;
      return { installed: true, config };
    },

    getTemplate(skillId) {
      return templates.get(skillId);
    },

    listCategories() {
      return ["customer_service", "sales", "productivity", "entertainment", "utility"];
    },

    getTopRated(limit = 10) {
      return Array.from(skills.values()).sort((a, b) => b.rating - a.rating).slice(0, limit);
    },
  };
}
