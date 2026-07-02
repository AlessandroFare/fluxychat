/**
 * P22-F5: Lock Scope Types
 */

export type LockScopeType = 'thread' | 'channel' | 'room';

export type LockPlatform =
  | 'slack'
  | 'teams'
  | 'discord'
  | 'telegram'
  | 'whatsapp'
  | 'google-chat'
  | 'github'
  | 'matrix'
  | 'irc'
  | 'twitch'
  | 'web';

export interface LockResource {
  id: string;
  scope: LockScopeType;
  ttl?: number;
  owner?: string;
}

export interface LockScopeHandle {
  acquire(): Promise<boolean>;
  release(): Promise<boolean>;
  isLocked(): Promise<{ locked: boolean; owner?: string }>;
  withLock<T>(fn: () => Promise<T>): Promise<T>;
}
