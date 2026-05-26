const TEMPLATE_VAR_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export interface FluxyMessageTemplate {
  id: string;
  projectId: string;
  name: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface FluxySendMessageOptions {
  templateId?: string;
  templateVars?: Record<string, string | number | boolean | null | undefined>;
}

export interface FluxyProjectActivity {
  id: string;
  kind: "automation" | "webhook" | "agent_run";
  title: string;
  status: string;
  roomId?: string;
  createdAt: string;
  detail?: string;
  webhookId?: string;
  agentId?: string;
}

export function renderMessageTemplate(
  body: string,
  vars: Record<string, string | number | boolean | null | undefined> = {},
): string {
  return body.replace(TEMPLATE_VAR_RE, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

/** Unique `{{var}}` keys in template body (declaration order). */
export function extractTemplateVarNames(body: string): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const re = new RegExp(TEMPLATE_VAR_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const key = match[1];
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}
