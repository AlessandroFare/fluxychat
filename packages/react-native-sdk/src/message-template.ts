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
  visibility?: 'room' | 'whisper';
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
  const matches = body.match(/\{\{\s*(\w+)\s*\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{\s*|\s*\}\}/g, '')))];
}
