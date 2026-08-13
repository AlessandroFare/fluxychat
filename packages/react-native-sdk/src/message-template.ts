export interface FluxyMessageTemplate {
  id: string;
  name: string;
  body: string;
  vars?: string[];
  createdByUserId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FluxySendMessageOptions {
  templateId?: string;
  templateVars?: Record<string, string | number | boolean | null | undefined>;
  expiresInSeconds?: number;
  expiresAt?: string;
  visibility?: 'room' | 'whisper' | `role:${string}`;
  visibleTo?: string[];
}

export type FluxyPresenceIntent = 'chat' | 'compose' | 'idle';

export interface FluxyProjectActivity {
  id: string;
  kind: string;
  roomId?: string;
  userId?: string;
  data?: unknown;
  createdAt: string;
}

export function renderMessageTemplate(template: FluxyMessageTemplate, vars: Record<string, string | number | boolean | null | undefined>): string {
  let out = template.body;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), String(value ?? ''));
  }
  return out;
}

export function extractTemplateVarNames(body: string): string[] {
  const names: string[] = [];
  let i = 0;
  while (i < body.length) {
    const open = body.indexOf('{{', i);
    if (open === -1) break;
    const close = body.indexOf('}}', open + 2);
    if (close === -1) break;
    const inner = body.slice(open + 2, close).trim();
    if (/^\w+$/.test(inner)) names.push(inner);
    i = close + 2;
  }
  return [...new Set(names)];
}
