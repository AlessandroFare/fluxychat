/**
 * P24-12: Dynamic System Prompts — Worker Implementation
 */

/**
 * Create a prompt renderer.
 */
export function createPromptRenderer() {
  return {
    render(template, variables) {
      let result = template;
      for (const [key, value] of Object.entries(variables)) {
        const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
        result = result.replace(pattern, value != null ? String(value) : "");
      }
      return result;
    },

    validate(template, variables) {
      const vars = this.extractVariables(template);
      const missing = vars.filter((v) => !(v in variables) || variables[v] === undefined);
      return { valid: missing.length === 0, missing };
    },

    extractVariables(template) {
      const matches = template.match(/\{\{\s*(\w+)\s*\}\}/g) || [];
      return [...new Set(matches.map((m) => m.replace(/[{}]/g, "").trim()))];
    },
  };
}

/**
 * Create a prompt template registry.
 */
export function createPromptTemplateRegistry() {
  const templates = new Map();
  const renderer = createPromptRenderer();

  return {
    register(template) {
      templates.set(template.name, template);
    },

    get(name) {
      return templates.get(name) || null;
    },

    list(category) {
      const all = [...templates.values()];
      if (category) return all.filter((t) => t.category === category);
      return all;
    },

    render(name, variables) {
      const template = templates.get(name);
      if (!template) throw new Error(`Template not found: ${name}`);
      return renderer.render(template.template, variables);
    },

    delete(name) {
      templates.delete(name);
    },
  };
}

/**
 * Built-in prompt templates.
 */
export const BUILTIN_PROMPT_TEMPLATES = [
  {
    name: "code-review",
    description: "Code review prompt",
    template: "Review the following {{language}} code for bugs, security issues, and performance improvements:\n\n```{{language}}\n{{code}}\n```",
    variables: [
      { name: "language", type: "string", required: true },
      { name: "code", type: "string", required: true },
    ],
    category: "coding",
  },
  {
    name: "summarize",
    description: "Summarize text",
    template: "Summarize the following text in {{style}} style:\n\n{{text}}",
    variables: [
      { name: "text", type: "string", required: true },
      { name: "style", type: "string", default: "concise", enum: ["concise", "detailed", "bullet-points"] },
    ],
    category: "writing",
  },
  {
    name: "translate",
    description: "Translate text",
    template: "Translate the following text to {{targetLanguage}}:\n\n{{text}}",
    variables: [
      { name: "text", type: "string", required: true },
      { name: "targetLanguage", type: "string", required: true },
    ],
    category: "writing",
  },
];
